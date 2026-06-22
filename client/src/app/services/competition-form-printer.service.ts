export type FormRecipient = '裁判（一）' | '裁判（二）' | '會場管理' | '檢錄存查' | '公告';

export interface CompetitionPrintContext {
  competition: any;
  group: any;
  event: any;
}

export class CompetitionFormPrinterService {
  private readonly recipients: FormRecipient[] = [
    '裁判（一）',
    '裁判（二）',
    '會場管理',
    '檢錄存查',
    '公告'
  ];

  openLoadingWindow(): Window | null {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return null;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="zh-Hant"><head><meta charset="utf-8"><title>準備競賽表單</title></head>
      <body style="font-family:Arial,'Noto Sans TC',sans-serif;padding:40px;text-align:center">
        <h2>正在準備競賽表單…</h2>
        <p>請稍候，系統正在整理目前賽制的選手名單。</p>
      </body></html>`);
    printWindow.document.close();
    return printWindow;
  }

  print(printWindow: Window, context: CompetitionPrintContext): void {
    printWindow.document.open();
    printWindow.document.write(this.buildDocument(context));
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 350);
  }

  buildDocument(context: CompetitionPrintContext): string {
    const { competition, group, event } = context;
    const round = event.currentRound || event.rounds?.[0] || '決賽';
    const heats = event.heats?.length ? event.heats : [];
    const pages = heats.flatMap((heat: any, heatIndex: number) => {
      const heatPages = this.paginateHeat(heat, 12);
      return heatPages.flatMap((pageHeat, pageIndex) =>
        this.recipients.map(recipient =>
          this.buildPage(
            competition,
            group,
            event,
            round,
            pageHeat,
            heatIndex,
            heats.length,
            recipient,
            pageIndex,
            heatPages.length
          )
        )
      );
    });

    return `<!doctype html>
      <html lang="zh-Hant">
        <head>
          <meta charset="utf-8">
          <title>${this.escape(`${competition?.name || '田徑競賽'}-${group?.name || ''}-${event.name}-${round}`)}</title>
          <style>${this.styles(event.type)}</style>
        </head>
        <body>${pages.join('')}</body>
      </html>`;
  }

  showError(printWindow: Window, message: string): void {
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
      <title>無法產生表單</title></head><body style="font-family:Arial,'Noto Sans TC',sans-serif;padding:40px">
      <h2>無法產生表單</h2><p>${this.escape(message)}</p></body></html>`);
    printWindow.document.close();
  }

  private buildPage(
    competition: any,
    group: any,
    event: any,
    round: string,
    heat: any,
    heatIndex: number,
    heatCount: number,
    recipient: FormRecipient,
    pageIndex: number,
    pageCount: number
  ): string {
    const isField = event.type === 'field';
    const title = isField ? '田賽檢錄紀錄表' : '徑賽檢錄紀錄表';
    const rows = isField
      ? this.fieldRows(heat?.lanes || [])
      : this.trackRows(heat?.lanes || [], heatIndex);
    const date = this.formatDate(competition?.dateStart);
    const heatLabel = heat?.name || `${round}第 ${heatIndex + 1} 組`;

    const isCompact = !isField && (heat?.lanes?.length || 0) > 8;
    const pageLabel = pageCount > 1 ? `（第 ${pageIndex + 1}/${pageCount} 頁）` : '';

    return `<section class="print-page ${isField ? 'field-page' : 'track-page'} ${isCompact ? 'compact' : ''}">
      <div class="recipient">${this.escape(recipient)}</div>
      <header>
        <div class="competition-name">${this.escape(competition?.name || '田徑競賽')}</div>
        <h1>${title}</h1>
      </header>
      <div class="meta-grid">
        <div><b>場次：</b></div>
        <div class="wide"><b>組別項目：</b>${this.escape(`${group?.name || ''} ${event.name} ${round}`)}</div>
        <div><b>人數：</b>${this.competitorCount(heat?.lanes || [])}</div>
        <div><b>取數：</b></div>
        <div><b>日期：</b>${this.escape(date)}</div>
        <div><b>地點：</b>${this.escape(competition?.location || '')}</div>
        <div><b>組數：</b>${heatIndex + 1}/${heatCount}</div>
        <div class="wide"><b>分組：</b>${this.escape(`${heatLabel}${pageLabel}`)}</div>
      </div>
      <table>
        <thead>${isField ? this.fieldHeader(event.name) : this.trackHeader()}</thead>
        <tbody>${rows}</tbody>
      </table>
      ${isField ? this.fieldSignature() : this.trackSignature()}
      <footer>
        <span>${this.escape(`${group?.name || ''}｜${event.name}｜${round}｜${heatLabel}${pageLabel}`)}</span>
        <span>用途：${this.escape(recipient)}</span>
      </footer>
    </section>`;
  }

  private trackHeader(): string {
    return `<tr>
      <th class="check">檢錄</th><th>組別</th><th>道次</th><th>號碼</th>
      <th class="name">姓名</th><th class="team">單位</th><th>參賽成績</th>
      <th>成績</th><th>名次</th><th class="note">備註</th>
    </tr>`;
  }

  private trackRows(lanes: any[], heatIndex: number): string {
    const minRows = Math.max(lanes.length, 8);
    return Array.from({ length: minRows }, (_, index) => {
      const lane = lanes[index] || {};
      const athlete = lane.athlete || {};
      return `<tr>
        <td></td>
        <td>${heatIndex + 1}</td>
        <td>${this.escape(lane.laneNumber ?? index + 1)}</td>
        <td>${this.escape(athlete.bibNumber || '')}</td>
        <td class="text">${this.escape(athlete.name || '')}</td>
        <td class="text">${this.escape(athlete.team || '')}</td>
        <td>${this.performance(athlete.personalBest)}</td>
        <td></td><td></td><td></td>
      </tr>`;
    }).join('');
  }

  private fieldHeader(eventName: string): string {
    const attemptLabel = /跳高|撐竿/.test(eventName) ? '試跳高度／紀錄' : '試跳／試擲紀錄';
    return `<tr>
      <th class="check">檢錄</th><th>順序</th><th>號碼</th><th class="name">姓名</th>
      <th class="team">單位</th><th colspan="6">${attemptLabel}</th>
      <th>最佳</th><th>名次</th><th class="note">備註</th>
    </tr>
    <tr class="attempts"><th colspan="5"></th>
      <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
      <th colspan="3"></th>
    </tr>`;
  }

  private fieldRows(lanes: any[]): string {
    const minRows = Math.max(lanes.length, 12);
    return Array.from({ length: minRows }, (_, index) => {
      const lane = lanes[index] || {};
      const athlete = lane.athlete || {};
      return `<tr>
        <td></td>
        <td>${index + 1}</td>
        <td>${this.escape(athlete.bibNumber || '')}</td>
        <td class="text">${this.escape(athlete.name || '')}</td>
        <td class="text">${this.escape(athlete.team || '')}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td>
      </tr>`;
    }).join('');
  }

  private trackSignature(): string {
    return `<div class="signatures track-signatures">
      <div>檢錄裁判長：</div><div>檢錄主任：</div><div>檢錄員：</div>
      <div>徑賽裁判長：</div><div>終點主任：</div><div>裁判員：</div>
    </div>`;
  }

  private fieldSignature(): string {
    return `<div class="signatures field-signatures">
      <div>檢錄裁判長：</div><div>檢錄主任：</div>
      <div>田賽裁判長：</div><div>項目主任：</div>
    </div>`;
  }

  private styles(type: string): string {
    const landscape = type === 'field';
    return `
      @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 9mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; color: #000; font-family: "Noto Serif TC", "PMingLiU", "MingLiU", serif; }
      body { background: #eee; }
      .print-page {
        position: relative; width: 100%; min-height: ${landscape ? '0' : '277mm'};
        padding: 4mm 5mm 3mm; margin: 0 auto 8mm; background: #fff;
        page-break-after: always; break-after: page;
      }
      .print-page:last-child { page-break-after: auto; break-after: auto; }
      .recipient {
        position: absolute; right: 5mm; top: 4mm; border: 2px solid #000;
        border-radius: 4px; padding: 2mm 5mm; font: 700 14pt Arial, sans-serif;
      }
      header { text-align: center; margin-bottom: 3mm; }
      .competition-name { font-size: 15pt; letter-spacing: 1px; margin-bottom: 1mm; }
      h1 { font-size: 20pt; letter-spacing: 5px; margin: 0; }
      .meta-grid {
        display: grid; grid-template-columns: 1fr 2fr 1fr;
        border: 1.5px solid #000; border-bottom: 0; font-size: 11pt;
      }
      .meta-grid > div { min-height: 9mm; padding: 2mm 2.5mm; border-right: 1px solid #000; border-bottom: 1px solid #000; }
      .meta-grid > div:nth-child(3n) { border-right: 0; }
      .meta-grid .wide { font-size: 12pt; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10.5pt; }
      th, td { border: 1px solid #000; height: ${landscape ? '6.5mm' : '14mm'}; padding: 1mm; text-align: center; }
      .track-page.compact th, .track-page.compact td { height: 9.5mm; }
      th { font-weight: 700; white-space: nowrap; }
      td.text { text-align: left; padding-left: 2mm; }
      .check { width: 8%; } .name { width: 13%; } .team { width: 15%; } .note { width: 10%; }
      .attempts th { height: 7mm; }
      .signatures {
        display: grid; gap: 0; border: 1.5px solid #000; border-top: 0; font-size: 11pt;
      }
      .track-signatures { grid-template-columns: repeat(3, 1fr); }
      .field-signatures { grid-template-columns: repeat(2, 1fr); }
      .signatures div { min-height: ${landscape ? '8mm' : '16mm'}; padding: 2mm 3mm; border-right: 1px solid #000; border-bottom: 1px solid #000; }
      .signatures div:nth-child(${landscape ? '2n' : '3n'}) { border-right: 0; }
      footer { display: flex; justify-content: space-between; padding-top: 2mm; font-size: 9pt; }
      @media screen {
        body { padding: 12px; }
        .print-page { max-width: ${landscape ? '297mm' : '210mm'}; box-shadow: 0 2px 12px #999; }
      }
      @media print {
        body { background: #fff; }
        .print-page { margin: 0; box-shadow: none; }
      }
    `;
  }

  private competitorCount(lanes: any[]): number {
    return lanes.filter(lane => lane?.athlete || lane?.athleteId).length;
  }

  private paginateHeat(heat: any, pageSize: number): any[] {
    const lanes = heat?.lanes || [];
    if (lanes.length <= pageSize) return [heat];
    const pages: any[] = [];
    for (let index = 0; index < lanes.length; index += pageSize) {
      pages.push({ ...heat, lanes: lanes.slice(index, index + pageSize) });
    }
    return pages;
  }

  private performance(value: unknown): string {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? String(value) : '';
  }

  private formatDate(value: unknown): string {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  }

  private escape(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
