import { describe, expect, it } from 'vitest';
import { CompetitionFormPrinterService } from './competition-form-printer.service';

describe('CompetitionFormPrinterService', () => {
  const printer = new CompetitionFormPrinterService();
  const baseContext = {
    competition: {
      name: '市運田徑競賽',
      dateStart: '2026-06-22',
      location: '市立田徑場'
    },
    group: { name: '國小女童組' },
    event: {
      name: '100 公尺',
      type: 'track',
      currentRound: '預賽',
      rounds: ['預賽', '決賽'],
      heats: [{
        name: '預賽第 1 組',
        lanes: Array.from({ length: 8 }, (_, index) => ({
          laneNumber: index + 1,
          athleteId: `athlete-${index}`,
          athlete: {
            bibNumber: `${101 + index}`,
            name: `選手${index + 1}`,
            team: `學校${index + 1}`
          }
        }))
      }]
    }
  };

  it('creates five recipient copies for each heat', () => {
    const html = printer.buildDocument(baseContext);

    expect((html.match(/class="print-page/g) || []).length).toBe(5);
    expect(html).toContain('裁判（一）');
    expect(html).toContain('裁判（二）');
    expect(html).toContain('會場管理');
    expect(html).toContain('檢錄存查');
    expect(html).toContain('公告');
    expect(html).toContain('國小女童組 100 公尺 預賽');
  });

  it('paginates large field-event groups and escapes athlete text', () => {
    const context = {
      ...baseContext,
      event: {
        ...baseContext.event,
        name: '跳遠',
        type: 'field',
        currentRound: '決賽',
        heats: [{
          name: '出場順序',
          lanes: Array.from({ length: 13 }, (_, index) => ({
            laneNumber: index + 1,
            athleteId: `field-${index}`,
            athlete: {
              bibNumber: `${201 + index}`,
              name: index === 0 ? '<script>alert(1)</script>' : `選手${index + 1}`,
              team: `學校${index + 1}`
            }
          }))
        }]
      }
    };

    const html = printer.buildDocument(context);

    expect((html.match(/class="print-page/g) || []).length).toBe(10);
    expect(html).toContain('第 1/2 頁');
    expect(html).toContain('第 2/2 頁');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
