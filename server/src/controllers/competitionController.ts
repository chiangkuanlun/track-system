import { Request, Response } from 'express';
import fs from 'fs';
import * as XLSX from 'xlsx';
import Competition from '../models/Competition';
import Group from '../models/Group';
import Event, { EventType } from '../models/Event';
import Athlete from '../models/Athlete';
import User from '../models/User';
import { AuthRequest, filterAssignedGroups } from '../middleware/authMiddleware';

const ROUND_ORDER = ['預賽', '複賽', '準決賽', '決賽'];
const VALID_STATUSES = new Set(['Normal', 'DNS', 'DNF', 'DQ', 'NM']);

const clean = (value: unknown): string => String(value ?? '').trim();

const parsePerformance = (value: unknown): number => {
  const text = clean(value).replace(/：/g, ':').replace(/，/g, '.');
  if (!text) return 0;
  if (text.includes(':')) {
    const parts = text.split(':').map(Number);
    if (parts.every(Number.isFinite)) {
      return parts.reduce((total, part) => total * 60 + part, 0);
    }
  }
  const dotParts = text.split('.');
  if (dotParts.length >= 3 && dotParts.every(part => /^\d+$/.test(part))) {
    const minutes = Number(dotParts.shift());
    const seconds = Number(`${dotParts.shift()}.${dotParts.join('')}`);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

export const classifyEvent = (name: string): EventType => {
  const normalized = name.replace(/\s+/g, '').toLowerCase();
  if (/(接力|relay|4[x×]\d+)/i.test(normalized)) return 'relay';
  if (/(跳高|跳遠|三級跳|撐竿跳|鉛球|鐵餅|標槍|鏈球|擲球|投擲|推鉛球|十項|七項)/.test(normalized)) {
    return 'field';
  }
  return 'track';
};

const defaultRounds = (type: EventType, athleteCount = 0): string[] => {
  if (type === 'field') return ['決賽'];
  if (athleteCount <= 8) return ['決賽'];
  if (athleteCount <= 24) return ['預賽', '決賽'];
  if (athleteCount <= 48) return ['預賽', '準決賽', '決賽'];
  return ['預賽', '複賽', '準決賽', '決賽'];
};

const lanePriority = (laneCount: number): number[] => {
  const centerLeft = Math.ceil(laneCount / 2);
  const result: number[] = [];
  for (let offset = 0; result.length < laneCount; offset++) {
    const right = centerLeft + offset;
    const left = centerLeft - offset - 1;
    if (right >= 1 && right <= laneCount) result.push(right);
    if (left >= 1 && left <= laneCount) result.push(left);
  }
  return result;
};

const seededGroups = (competitors: any[], capacity: number): any[][] => {
  if (!competitors.length) return [];
  const groupCount = Math.ceil(competitors.length / capacity);
  const groups = Array.from({ length: groupCount }, () => [] as any[]);
  competitors.forEach((competitor, index) => {
    const cycle = Math.floor(index / groupCount);
    const position = index % groupCount;
    const groupIndex = cycle % 2 === 0 ? position : groupCount - 1 - position;
    groups[groupIndex].push(competitor);
  });
  return groups;
};

const toDisplayEvent = async (event: any): Promise<any> => {
  const object = event.toObject ? event.toObject() : event;
  const ids = (object.heats || [])
    .flatMap((heat: any) => heat.lanes || [])
    .map((lane: any) => lane.athleteId?._id || lane.athleteId)
    .filter(Boolean)
    .map(String);
  const athletes = ids.length ? await Athlete.find({ _id: { $in: ids } }).lean() : [];
  const map = new Map(athletes.map((athlete: any) => [athlete._id.toString(), athlete]));
  object.heats = (object.heats || []).map((heat: any) => ({
    ...heat,
    lanes: (heat.lanes || []).map((lane: any) => {
      const id = lane.athleteId?._id || lane.athleteId;
      const athlete = id ? map.get(String(id)) : null;
      if (athlete && object.type === 'relay') {
        return {
          ...lane,
          athleteId: String(id),
          athlete: { ...athlete, name: athlete.team, team: '', bibNumber: '' }
        };
      }
      return { ...lane, athleteId: id ? String(id) : null, athlete };
    })
  }));
  return object;
};

const autoAssignGroups = async (competitionId: string): Promise<number> => {
  const recorders = await User.find({ role: 'recorder', active: true });
  if (!recorders.length) return 0;
  const groups = await Group.find({ competitionId }).sort({ sortOrder: 1, name: 1 });
  const load = new Map(recorders.map(user => [user._id.toString(), user.assignedGroupIds.length]));
  let assigned = 0;

  for (const group of groups) {
    const alreadyAssigned = recorders.some(user =>
      user.assignedGroupIds.some(id => id.toString() === group._id.toString())
    );
    if (alreadyAssigned) continue;

    const eventTypes = await Event.distinct('type', { groupId: group._id }) as EventType[];
    const eligible = recorders.filter(user =>
      !user.specialties.length || eventTypes.some(type => user.specialties.includes(type))
    );
    const pool = eligible.length ? eligible : recorders;
    pool.sort((a, b) =>
      (load.get(a._id.toString()) || 0) - (load.get(b._id.toString()) || 0) ||
      a.name.localeCompare(b.name)
    );
    const selected = pool[0];
    selected.assignedGroupIds.push(group._id);
    await selected.save();
    load.set(selected._id.toString(), (load.get(selected._id.toString()) || 0) + 1);
    assigned++;
  }
  return assigned;
};

interface ImportRow {
  group: string;
  event: string;
  bibNumber: string;
  name: string;
  team: string;
  performance: number;
}

const parseStructuredRows = (sheet: XLSX.WorkSheet): ImportRow[] => {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const aliases: Record<string, string[]> = {
    group: ['組別', '競賽組別', 'group', 'category'],
    event: ['項目', '競賽項目', 'event'],
    bibNumber: ['號碼', '選手編號', 'bib', 'bibnumber'],
    name: ['姓名', '選手姓名', 'name'],
    team: ['單位', '隊伍', '學校', 'team'],
    performance: ['最佳成績', '參考成績', 'pb', 'performance']
  };
  const valueOf = (row: Record<string, unknown>, field: string): unknown => {
    const key = Object.keys(row).find(column =>
      aliases[field].includes(column.replace(/\s+/g, '').toLowerCase())
    );
    return key ? row[key] : '';
  };
  return rows.map(row => ({
    group: clean(valueOf(row, 'group')),
    event: clean(valueOf(row, 'event')),
    bibNumber: clean(valueOf(row, 'bibNumber')),
    name: clean(valueOf(row, 'name')),
    team: clean(valueOf(row, 'team')) || '未填單位',
    performance: parsePerformance(valueOf(row, 'performance'))
  })).filter(row => row.group && row.event && row.name);
};

const parseLegacyRows = (sheet: XLSX.WorkSheet): ImportRow[] => {
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  const output: ImportRow[] = [];
  let group = '';
  let event = '';
  for (const row of matrix) {
    for (const cell of row) {
      const text = clean(cell);
      if (!text) continue;
      const groupMatch = text.match(
        /^(?:第?[一二三四五六七八九十\d]+組|組別)\s*[:：、.]?\s*(.+)$|^[一二三四五六七八九十]+、\s*(.+?)(?:[（(](.+?)[）)])?$/
      );
      if (groupMatch) {
        group = clean(groupMatch[3] || groupMatch[2] || groupMatch[1]).replace(/[()（）]/g, '');
        event = '';
        continue;
      }
      const eventMatch = text.match(/^\d+\s*[、.．]\s*(.+)$/);
      if (eventMatch) {
        event = clean(eventMatch[1]);
        continue;
      }
      if (!group || !event) continue;

      if (classifyEvent(event) === 'relay') {
        const relay = text.match(/^(.+?)(?:\s+([\d:.]+))?\s*[:：]\s*(.+)$/);
        if (relay) {
          const team = clean(relay[1]);
          const performance = parsePerformance(relay[2]);
          clean(relay[3]).split(/\s+/).filter(Boolean).forEach((name, index) => {
            output.push({ group, event, bibNumber: `R-${team}-${index + 1}`, name, team, performance });
          });
          continue;
        }
      }

      const athlete = text.match(
        /^(\d+)\s+(.+?)\s*[（(](.+?)[）)](?:\s+([\d:.]+))?\s*$/
      );
      if (athlete) {
        output.push({
          group, event,
          bibNumber: clean(athlete[1]),
          name: clean(athlete[2]),
          team: clean(athlete[3]) || '未填單位',
          performance: parsePerformance(athlete[4])
        });
      }
    }
  }
  return output;
};

export const parseRegistrationWorkbook = (workbook: XLSX.WorkBook): ImportRow[] => {
  const allRows: ImportRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    let rows = parseStructuredRows(sheet);
    if (!rows.length) rows = parseLegacyRows(sheet);
    allRows.push(...rows);
  }
  return allRows;
};

export const getCompetitions = async (_req: Request, res: Response): Promise<void> => {
  res.json(await Competition.find({}).sort({ dateStart: -1 }));
};

export const getCompetitionById = async (req: Request, res: Response): Promise<void> => {
  const competition = await Competition.findById(req.params.id).lean();
  if (!competition) {
    res.status(404).json({ message: '找不到賽事' });
    return;
  }
  res.json(competition);
};

export const getCurrentCompetition = async (_req: Request, res: Response): Promise<void> => {
  const competition = await Competition.findOne().sort({ createdAt: -1 });
  if (!competition) {
    res.status(404).json({ message: '目前沒有賽事' });
    return;
  }
  const [groupCount, athleteCount, eventCount, teams] = await Promise.all([
    Group.countDocuments({ competitionId: competition._id }),
    Athlete.countDocuments({ competitionId: competition._id } as any),
    Event.countDocuments({ competitionId: competition._id }),
    Athlete.distinct('team', { competitionId: competition._id } as any)
  ]);
  res.json({ ...competition.toObject(), groupCount, athleteCount, eventCount, teamCount: teams.length });
};

export const createCompetition = async (req: Request, res: Response): Promise<void> => {
  const { name, dateStart, dateEnd, location } = req.body;
  if (!name || !dateStart || !dateEnd || !location) {
    res.status(400).json({ message: '賽事名稱、日期與地點皆為必填' });
    return;
  }
  res.status(201).json(await Competition.create({ name, dateStart, dateEnd, location, status: 'pending' }));
};

export const updateCompetition = async (req: Request, res: Response): Promise<void> => {
  const competition = await Competition.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true
  });
  if (!competition) {
    res.status(404).json({ message: '找不到賽事' });
    return;
  }
  res.json(competition);
};

export const deleteCompetition = async (req: Request, res: Response): Promise<void> => {
  const competition = await Competition.findById(req.params.id);
  if (!competition) {
    res.status(404).json({ message: '找不到賽事' });
    return;
  }
  const groups = await Group.find({ competitionId: competition._id }).select('_id');
  const groupIds = groups.map(group => group._id);
  await Promise.all([
    competition.deleteOne(),
    Group.deleteMany({ competitionId: competition._id }),
    Event.deleteMany({ competitionId: competition._id }),
    Athlete.deleteMany({ competitionId: competition._id } as any),
    User.updateMany({}, { $pull: { assignedGroupIds: { $in: groupIds } } })
  ]);
  res.json({ message: '賽事及相關資料已刪除' });
};

export const importAthletes = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: '請上傳 Excel 或 CSV 檔案' });
    return;
  }
  const filePath = req.file.path;
  try {
    const competition = await Competition.findById(req.params.id);
    if (!competition) {
      res.status(404).json({ message: '找不到賽事' });
      return;
    }
    const workbook = XLSX.readFile(filePath);
    const rows = parseRegistrationWorkbook(workbook);
    if (!rows.length) {
      res.status(422).json({
        message: '找不到可匯入的報名資料',
        expectedColumns: ['組別', '項目', '號碼', '姓名', '單位', '最佳成績']
      });
      return;
    }

    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    let skipped = 0;
    const eventMap = new Map<string, any>();

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      try {
        let group = await Group.findOne({ competitionId: competition._id, name: row.group });
        if (!group) group = await Group.create({ competitionId: competition._id, name: row.group });
        const eventKey = `${group._id}:${row.event}`;
        let event = eventMap.get(eventKey);
        if (!event) {
          const type = classifyEvent(row.event);
          event = await Event.findOneAndUpdate(
            { groupId: group._id, name: row.event },
            {
              $setOnInsert: {
                competitionId: competition._id, groupId: group._id,
                name: row.event, type, rounds: defaultRounds(type)
              }
            },
            { new: true, upsert: true, runValidators: true }
          );
          eventMap.set(eventKey, event);
        }
        const duplicateQuery = row.bibNumber
          ? { eventId: event._id, bibNumber: row.bibNumber }
          : { eventId: event._id, name: row.name, team: row.team };
        if (await Athlete.exists(duplicateQuery)) {
          skipped++;
          continue;
        }
        await Athlete.create({
          competitionId: competition._id,
          eventId: event._id,
          bibNumber: row.bibNumber,
          name: row.name,
          team: row.team,
          personalBest: row.performance
        });
        imported++;
      } catch (error: any) {
        errors.push({ row: index + 2, message: error.message || '資料寫入失敗' });
      }
    }

    for (const event of eventMap.values()) {
      const count = event.type === 'relay'
        ? (await Athlete.distinct('team', { eventId: event._id })).length
        : await Athlete.countDocuments({ eventId: event._id });
      if (!event.rounds?.length || event.rounds.join(',') === '決賽') {
        event.rounds = defaultRounds(event.type, count);
        await event.save();
      }
    }
    const assignedGroups = await autoAssignGroups(competition._id.toString());
    res.json({
      message: `成功匯入 ${imported} 筆報名資料`,
      imported, skipped, failed: errors.length, errors: errors.slice(0, 50), assignedGroups
    });
  } finally {
    fs.promises.unlink(filePath).catch(() => undefined);
  }
};

export const autoAssignPersonnel = async (req: Request, res: Response): Promise<void> => {
  const assigned = await autoAssignGroups(req.params.id);
  res.json({ message: assigned ? `已自動分派 ${assigned} 個組別` : '沒有待分派組別或尚未建立記錄員', assigned });
};

export const getGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  const allowed = await filterAssignedGroups(req);
  const query: any = { competitionId: req.params.competitionId };
  if (allowed !== null) query._id = { $in: allowed };
  const groups = await Group.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  const users = await User.find({ role: 'recorder', assignedGroupIds: { $in: groups.map(g => g._id) } })
    .select('name assignedGroupIds').lean();
  res.json(groups.map(group => ({
    ...group,
    assigneeNames: users
      .filter(user => user.assignedGroupIds.some(id => id.toString() === group._id.toString()))
      .map(user => user.name),
    assigneeName: users.find(user =>
      user.assignedGroupIds.some(id => id.toString() === group._id.toString())
    )?.name || null
  })));
};

export const updateGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!group) {
    res.status(404).json({ message: '找不到組別' });
    return;
  }
  res.json(group);
};

export const getEvents = async (req: Request, res: Response): Promise<void> => {
  const events = await Event.find({ groupId: req.params.groupId }).sort({ name: 1 }).lean();
  const result = await Promise.all(events.map(async event => ({
    ...event,
    athleteCount: event.type === 'relay'
      ? (await Athlete.distinct('team', { eventId: event._id })).length
      : await Athlete.countDocuments({ eventId: event._id })
  })));
  res.json(result);
};

export const getEvent = async (req: Request, res: Response): Promise<void> => {
  const event = await Event.findById(req.params.eventId || req.params.id);
  if (!event) {
    res.status(404).json({ message: '找不到競賽項目' });
    return;
  }
  res.json(await toDisplayEvent(event));
};

export const createEvent = async (req: Request, res: Response): Promise<void> => {
  const type = req.body.type || classifyEvent(req.body.name || '');
  const event = await Event.create({
    ...req.body, type,
    rounds: req.body.rounds?.length ? req.body.rounds : defaultRounds(type)
  });
  res.status(201).json(event);
};

export const updateEvent = async (req: Request, res: Response): Promise<void> => {
  const update = { ...req.body };
  if (update.name && !update.type) update.type = classifyEvent(update.name);
  if (update.rounds) {
    update.rounds = update.rounds.filter((round: string) => ROUND_ORDER.includes(round));
  }
  const event = await Event.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!event) {
    res.status(404).json({ message: '找不到競賽項目' });
    return;
  }
  res.json(event);
};

export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
  if (await Athlete.exists({ eventId: req.params.id })) {
    res.status(409).json({ message: '項目已有報名資料，請先移除選手' });
    return;
  }
  await Event.findByIdAndDelete(req.params.id);
  res.json({ message: '競賽項目已刪除' });
};

export const getAthletes = async (req: Request, res: Response): Promise<void> => {
  const event = await Event.findById(req.params.eventId);
  const athletes = await Athlete.find({ eventId: req.params.eventId }).sort({ bibNumber: 1 }).lean();
  if (event?.type !== 'relay') {
    res.json(athletes);
    return;
  }
  const teams = new Map<string, any>();
  athletes.forEach((athlete: any) => {
    if (!teams.has(athlete.team)) {
      teams.set(athlete.team, { ...athlete, name: athlete.team, team: '', bibNumber: '' });
    }
  });
  res.json([...teams.values()]);
};

export const createAthlete = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json(await Athlete.create(req.body));
};

export const updateAthlete = async (req: Request, res: Response): Promise<void> => {
  const athlete = await Athlete.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!athlete) {
    res.status(404).json({ message: '找不到選手' });
    return;
  }
  res.json(athlete);
};

export const deleteAthlete = async (req: Request, res: Response): Promise<void> => {
  await Athlete.findByIdAndDelete(req.params.id);
  res.json({ message: '選手已刪除' });
};

export const initializeHeats = async (req: Request, res: Response): Promise<void> => {
  const event = await Event.findById(req.params.eventId || req.params.id);
  if (!event) {
    res.status(404).json({ message: '找不到競賽項目' });
    return;
  }
  const athletes = await Athlete.find({ eventId: event._id }).lean();
  if (!athletes.length) {
    res.status(400).json({ message: '此項目沒有參賽者' });
    return;
  }

  let competitors: any[];
  if (event.type === 'relay') {
    const teams = new Map<string, any>();
    athletes.forEach((athlete: any) => {
      const current = teams.get(athlete.team);
      if (!current || (!current.personalBest && athlete.personalBest)) teams.set(athlete.team, athlete);
    });
    competitors = [...teams.values()];
  } else {
    competitors = athletes;
  }
  competitors.sort((a, b) => {
    const aValue = Number(a.personalBest || 0);
    const bValue = Number(b.personalBest || 0);
    if (!aValue && bValue) return 1;
    if (aValue && !bValue) return -1;
    if (aValue !== bValue) return event.type === 'field' ? bValue - aValue : aValue - bValue;
    return String(a.bibNumber || a._id).localeCompare(String(b.bibNumber || b._id));
  });

  const firstRound = event.rounds?.[0] || '決賽';
  const capacity = event.type === 'field' ? Math.max(competitors.length, 1) : event.laneCount || 8;
  const groups = event.type === 'field' ? [competitors] : seededGroups(competitors, capacity);
  const priorities = lanePriority(capacity);
  const heats = groups.map((group, heatIndex) => {
    const lanes = Array.from({ length: capacity }, (_, index) => ({
      laneNumber: index + 1, athleteId: null as any, result: '', rank: 0, status: 'Normal'
    }));
    group.forEach((competitor, index) => {
      const position = event.type === 'field' ? index + 1 : priorities[index];
      lanes[position - 1].athleteId = competitor._id;
    });
    return {
      name: event.type === 'field' ? '出場順序' : `${firstRound}第 ${heatIndex + 1} 組`,
      lanes
    };
  });
  event.heats = heats as any;
  event.currentRound = firstRound;
  event.roundResults = [];
  await event.save();
  res.json((await toDisplayEvent(event)).heats);
};

export const saveHeats = async (req: Request, res: Response): Promise<void> => {
  if (!Array.isArray(req.body.heats)) {
    res.status(400).json({ message: '分組資料格式錯誤' });
    return;
  }
  const heats = req.body.heats.map((heat: any) => ({
    name: clean(heat.name),
    lanes: (heat.lanes || []).map((lane: any, index: number) => ({
      laneNumber: Number(lane.laneNumber || index + 1),
      athleteId: lane.athlete?._id || lane.athleteId?._id || lane.athleteId || null,
      result: clean(lane.result),
      rank: Number(lane.rank || 0),
      status: VALID_STATUSES.has(lane.status) ? lane.status : 'Normal'
    }))
  }));
  const event = await Event.findByIdAndUpdate(req.params.eventId, { heats }, { new: true, runValidators: true });
  if (!event) {
    res.status(404).json({ message: '找不到競賽項目' });
    return;
  }
  res.json({ message: '分組與成績已儲存', event: await toDisplayEvent(event) });
};

const targetCountForRound = (event: any, nextRound: string): number => {
  if (event.advancementCount) return event.advancementCount;
  if (nextRound === '決賽') return Math.min(event.laneCount || 8, 8);
  if (nextRound === '準決賽') return 16;
  if (nextRound === '複賽') return 24;
  return event.laneCount || 8;
};

export const arrangeNextRound = async (req: Request, res: Response): Promise<void> => {
  const event = await Event.findById(req.params.eventId).populate('heats.lanes.athleteId') as any;
  if (!event) {
    res.status(404).json({ message: '找不到競賽項目' });
    return;
  }
  const currentIndex = event.rounds.indexOf(event.currentRound);
  if (currentIndex < 0 || currentIndex >= event.rounds.length - 1) {
    res.status(400).json({ message: '目前已是最後一輪' });
    return;
  }
  const nextRound = event.rounds[currentIndex + 1];
  const targetCount = targetCountForRound(event, nextRound);
  const perHeat = Math.max(0, Number(event.advancePerHeat ?? 2));
  const better = (a: any, b: any) =>
    event.type === 'field' ? b.value - a.value : a.value - b.value;
  const eligibleByHeat = event.heats.map((heat: any, heatIndex: number) =>
    heat.lanes
      .filter((lane: any) => lane.athleteId && lane.result && lane.status === 'Normal')
      .map((lane: any) => ({
        athlete: lane.athleteId,
        value: parsePerformance(lane.result),
        result: lane.result,
        heatIndex
      }))
      .filter((entry: any) => entry.value > 0)
      .sort(better)
  );
  if (eligibleByHeat.every((entries: any[]) => !entries.length)) {
    res.status(400).json({ message: '尚無有效成績可供晉級' });
    return;
  }

  const selected = new Map<string, any>();
  eligibleByHeat.forEach((entries: any[]) =>
    entries.slice(0, perHeat).forEach(entry => selected.set(entry.athlete._id.toString(), entry))
  );
  const remaining = eligibleByHeat.flat()
    .filter((entry: any) => !selected.has(entry.athlete._id.toString()))
    .sort(better);
  for (const entry of remaining) {
    if (selected.size >= targetCount) break;
    selected.set(entry.athlete._id.toString(), entry);
  }
  const qualifiers = [...selected.values()].sort(better);
  const cutoff = qualifiers[Math.min(targetCount, qualifiers.length) - 1]?.value;
  if (cutoff !== undefined) {
    remaining
      .filter((entry: any) => entry.value === cutoff)
      .forEach((entry: any) => selected.set(entry.athlete._id.toString(), entry));
  }
  const finalQualifiers = [...selected.values()].sort(better);

  event.roundResults.push({
    roundName: event.currentRound,
    heats: JSON.parse(JSON.stringify(event.heats))
  });
  const capacity = event.type === 'field' ? finalQualifiers.length : event.laneCount || 8;
  const groups = event.type === 'field'
    ? [finalQualifiers]
    : seededGroups(finalQualifiers, capacity);
  const priorities = lanePriority(capacity);
  event.heats = groups.map((group, groupIndex) => {
    const lanes = Array.from({ length: capacity }, (_, index) => ({
      laneNumber: index + 1, athleteId: null as any, result: '', rank: 0, status: 'Normal'
    }));
    group.forEach((entry, index) => {
      const position = event.type === 'field' ? index + 1 : priorities[index];
      lanes[position - 1].athleteId = entry.athlete._id;
    });
    return {
      name: event.type === 'field' ? `${nextRound}出場順序` : `${nextRound}第 ${groupIndex + 1} 組`,
      lanes
    };
  });
  event.currentRound = nextRound;
  await event.save();
  res.json({
    message: `已完成 ${nextRound} 編排`,
    nextRound,
    qualifierCount: finalQualifiers.length,
    tieExpanded: finalQualifiers.length > targetCount
  });
};

export const getRecentEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  const competitionId = clean(req.query.competitionId);
  if (!competitionId) {
    res.json([]);
    return;
  }
  const allowed = await filterAssignedGroups(req);
  const query: any = { competitionId };
  if (allowed !== null) query.groupId = { $in: allowed };
  const events = await Event.find(query)
    .sort({ updatedAt: -1 })
    .select('name currentRound rounds updatedAt groupId type heats roundResults')
    .populate('groupId', 'name');
  res.json(events.filter((event: any) =>
    event.heats?.some((heat: any) => heat.lanes?.some((lane: any) => lane.result)) ||
    event.roundResults?.some((round: any) =>
      round.heats?.some((heat: any) => heat.lanes?.some((lane: any) => lane.result))
    )
  ));
};

export const resetEventResults = async (req: Request, res: Response): Promise<void> => {
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    res.status(404).json({ message: '找不到競賽項目' });
    return;
  }
  (event.heats as any[]).forEach(heat => heat.lanes.forEach((lane: any) => {
    lane.result = ''; lane.rank = 0; lane.status = 'Normal';
  }));
  event.roundResults = [];
  event.currentRound = event.rounds?.[0] || '決賽';
  await event.save();
  res.json({ message: '成績已重設', data: event });
};
