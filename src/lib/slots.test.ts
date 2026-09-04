import { describe, expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import { availableSlots, generateSlots, periodKey, type SlotEventType } from '@/lib/slots'

const TZ = 'Europe/Budapest'

function eventType(overrides: Partial<SlotEventType> = {}): SlotEventType {
  return {
    durationMin: 45,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minimumNoticeMin: 0,
    frequencyLimitCount: null,
    frequencyLimitPeriod: null,
    slotIntervalMin: null,
    timezone: TZ,
    ...overrides,
  }
}

/** Az időpontok helyi kezdési ideje, könnyen olvasható formában. */
function labels(slots: { startsAt: Date }[]) {
  return slots.map((slot) => formatInTimeZone(slot.startsAt, TZ, 'yyyy-MM-dd HH:mm'))
}

/** Egy fix pillanat jóval a tesztadatok előtt, hogy semmi ne legyen "múltbeli". */
const NOW = new Date('2026-09-01T06:00:00.000Z')

describe('generateSlots — alap szeletelés', () => {
  it('a jóváhagyott példa szerint szeleteli a sávot (45 perc + 15 perc puffer)', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 45, bufferAfterMin: 15 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 12 * 60 }],
      bookings: [],
      now: NOW,
    })

    expect(labels(slots)).toEqual(['2026-09-03 09:00', '2026-09-03 10:00', '2026-09-03 11:00'])
    expect(slots.every((slot) => slot.available)).toBe(true)
  })

  it('nem generál időpontot, ha a találkozó nem fér el a sávban', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 9 * 60 + 45 }],
      bookings: [],
      now: NOW,
    })

    expect(slots).toEqual([])
  })

  it('az utolsó időpont pontosan a sáv végéig tarthat', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 30 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 10 * 60 }],
      bookings: [],
      now: NOW,
    })

    expect(labels(slots)).toEqual(['2026-09-03 09:00', '2026-09-03 09:30'])
  })

  it('a kézzel megadott lépésköz felülírja a hossz + puffer alapértelmezést', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60, slotIntervalMin: 30 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 11 * 60 }],
      bookings: [],
      now: NOW,
    })

    expect(labels(slots)).toEqual(['2026-09-03 09:00', '2026-09-03 09:30', '2026-09-03 10:00'])
  })

  it('az átfedő sávok nem eredményeznek duplikált időpontot', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 30 }),
      windows: [
        { date: '2026-09-03', startMin: 9 * 60, endMin: 10 * 60 },
        { date: '2026-09-03', startMin: 9 * 60, endMin: 11 * 60 },
      ],
      bookings: [],
      now: NOW,
    })

    expect(labels(slots)).toEqual([
      '2026-09-03 09:00',
      '2026-09-03 09:30',
      '2026-09-03 10:00',
      '2026-09-03 10:30',
    ])
  })

  it('a fordított sávot figyelmen kívül hagyja', () => {
    const slots = generateSlots({
      eventType: eventType(),
      windows: [{ date: '2026-09-03', startMin: 12 * 60, endMin: 9 * 60 }],
      bookings: [],
      now: NOW,
    })

    expect(slots).toEqual([])
  })
})

describe('generateSlots — ütközés és pufferek', () => {
  it('a foglalt időpontot kizárja, a többit meghagyja', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 12 * 60 }],
      bookings: [
        {
          startsAt: new Date('2026-09-03T08:00:00.000Z'), // 10:00 helyi idő
          endsAt: new Date('2026-09-03T09:00:00.000Z'),
        },
      ],
      now: NOW,
    })

    expect(labels(availableSlots(slots))).toEqual(['2026-09-03 09:00', '2026-09-03 11:00'])
    expect(slots.find((slot) => !slot.available)?.reason).toBe('BOOKED')
  })

  it('az utólagos puffer a következő időpontot is blokkolja', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60, bufferAfterMin: 30, slotIntervalMin: 60 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 13 * 60 }],
      bookings: [
        {
          startsAt: new Date('2026-09-03T07:00:00.000Z'), // 09:00 helyi idő
          endsAt: new Date('2026-09-03T08:00:00.000Z'), // 10:00-ig, puffer 10:30-ig
        },
      ],
      now: NOW,
    })

    // A 10:00 a puffer miatt esik ki, a 11:00 már szabad.
    expect(labels(availableSlots(slots))).toEqual(['2026-09-03 11:00', '2026-09-03 12:00'])
  })

  it('a pontosan a puffer után kezdődő időpont még foglalható', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 45, bufferAfterMin: 15, slotIntervalMin: 60 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 12 * 60 }],
      bookings: [
        {
          startsAt: new Date('2026-09-03T07:00:00.000Z'), // 09:00–09:45, puffer 10:00-ig
          endsAt: new Date('2026-09-03T07:45:00.000Z'),
        },
      ],
      now: NOW,
    })

    expect(labels(availableSlots(slots))).toEqual(['2026-09-03 10:00', '2026-09-03 11:00'])
  })

  it('a lemondott foglalás nem blokkol — a hívó csak az érvényeseket adja át', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60 }),
      windows: [{ date: '2026-09-03', startMin: 9 * 60, endMin: 11 * 60 }],
      bookings: [],
      now: NOW,
    })

    expect(availableSlots(slots)).toHaveLength(2)
  })
})

describe('generateSlots — minimális előfoglalási idő', () => {
  const windows = [{ date: '2026-09-03', startMin: 9 * 60, endMin: 12 * 60 }]

  it('kiszűri a túl közeli időpontokat', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60, minimumNoticeMin: 6 * 60 }),
      windows,
      // 2026-09-03 06:00 helyi idő; 6 óra türelmi idő => 12:00 előtt semmi
      now: new Date('2026-09-03T04:00:00.000Z'),
      bookings: [],
    })

    expect(availableSlots(slots)).toEqual([])
    expect(slots.every((slot) => slot.reason === 'TOO_SOON')).toBe(true)
  })

  it('a határon lévő időpont még foglalható', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60, minimumNoticeMin: 6 * 60 }),
      windows,
      // 2026-09-03 03:00 helyi idő => a 09:00 pontosan 6 órára van
      now: new Date('2026-09-03T01:00:00.000Z'),
      bookings: [],
    })

    expect(labels(availableSlots(slots))).toContain('2026-09-03 09:00')
  })

  it('a múltbeli időpontot PAST okkal jelöli', () => {
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60 }),
      windows,
      now: new Date('2026-09-03T08:30:00.000Z'), // 10:30 helyi idő
      bookings: [],
    })

    expect(slots.find((slot) => slot.reason === 'PAST')).toBeDefined()
    expect(labels(availableSlots(slots))).toEqual(['2026-09-03 11:00'])
  })
})

describe('generateSlots — gyakorisági korlát', () => {
  const windows = [{ date: '2026-09-03', startMin: 9 * 60, endMin: 15 * 60 }]

  it('a napi limit elérésekor az adott nap összes időpontját lezárja', () => {
    const slots = generateSlots({
      eventType: eventType({
        durationMin: 60,
        frequencyLimitCount: 1,
        frequencyLimitPeriod: 'DAY',
      }),
      windows,
      bookings: [
        {
          startsAt: new Date('2026-09-03T07:00:00.000Z'), // 09:00 helyi
          endsAt: new Date('2026-09-03T08:00:00.000Z'),
        },
      ],
      now: NOW,
    })

    expect(availableSlots(slots)).toEqual([])
    // A foglalt óra BOOKED, a többi FREQUENCY_LIMIT.
    expect(slots.filter((slot) => slot.reason === 'FREQUENCY_LIMIT').length).toBeGreaterThan(0)
  })

  it('a limit alatt még enged foglalni', () => {
    const slots = generateSlots({
      eventType: eventType({
        durationMin: 60,
        frequencyLimitCount: 3,
        frequencyLimitPeriod: 'DAY',
      }),
      windows,
      bookings: [
        {
          startsAt: new Date('2026-09-03T07:00:00.000Z'),
          endsAt: new Date('2026-09-03T08:00:00.000Z'),
        },
      ],
      now: NOW,
    })

    expect(availableSlots(slots).length).toBeGreaterThan(0)
  })

  it('a másik napi foglalás nem számít bele a napi limitbe', () => {
    const slots = generateSlots({
      eventType: eventType({
        durationMin: 60,
        frequencyLimitCount: 1,
        frequencyLimitPeriod: 'DAY',
      }),
      windows,
      bookings: [
        {
          startsAt: new Date('2026-09-02T07:00:00.000Z'),
          endsAt: new Date('2026-09-02T08:00:00.000Z'),
        },
      ],
      now: NOW,
    })

    expect(availableSlots(slots).length).toBe(6)
  })

  it('a heti limit hétfőtől vasárnapig számol', () => {
    // 2026-09-03 csütörtök; a hét hétfője 2026-08-31.
    expect(periodKey(new Date('2026-09-03T07:00:00.000Z'), TZ, 'WEEK')).toBe('2026-08-31')
    expect(periodKey(new Date('2026-08-31T07:00:00.000Z'), TZ, 'WEEK')).toBe('2026-08-31')
    // Vasárnap még ugyanaz a hét.
    expect(periodKey(new Date('2026-09-06T07:00:00.000Z'), TZ, 'WEEK')).toBe('2026-08-31')
    // Hétfő már a következő.
    expect(periodKey(new Date('2026-09-07T07:00:00.000Z'), TZ, 'WEEK')).toBe('2026-09-07')
  })

  it('a havi limit a naptári hónapot nézi', () => {
    expect(periodKey(new Date('2026-09-03T07:00:00.000Z'), TZ, 'MONTH')).toBe('2026-09')
    expect(periodKey(new Date('2026-10-01T07:00:00.000Z'), TZ, 'MONTH')).toBe('2026-10')
  })
})

describe('generateSlots — nyári időszámítás (Europe/Budapest)', () => {
  it('tavaszi óraátállításkor a hiányzó órát nem duplázza', () => {
    // 2026-03-29-én 02:00-kor 03:00-ra ugrik az óra.
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60, slotIntervalMin: 60 }),
      windows: [{ date: '2026-03-29', startMin: 0, endMin: 6 * 60 }],
      bookings: [],
      now: new Date('2026-03-01T00:00:00.000Z'),
    })

    // A nap 23 órás: 00:00–06:00 helyi idő valójában 5 óra.
    expect(labels(slots)).toEqual([
      '2026-03-29 00:00',
      '2026-03-29 01:00',
      '2026-03-29 03:00',
      '2026-03-29 04:00',
      '2026-03-29 05:00',
    ])

    // Az időpontok valóban egymást követő, hézagmentes UTC pillanatok.
    const starts = slots.map((slot) => slot.startsAt.toISOString())
    expect(starts).toEqual([
      '2026-03-28T23:00:00.000Z',
      '2026-03-29T00:00:00.000Z',
      '2026-03-29T01:00:00.000Z',
      '2026-03-29T02:00:00.000Z',
      '2026-03-29T03:00:00.000Z',
    ])
  })

  it('őszi óraátállításkor a helyi fali óra marad az irányadó', () => {
    // 2026-10-25-én 03:00-kor 02:00-ra áll vissza az óra.
    const slots = generateSlots({
      eventType: eventType({ durationMin: 60, slotIntervalMin: 60 }),
      windows: [{ date: '2026-10-25', startMin: 0, endMin: 6 * 60 }],
      bookings: [],
      now: new Date('2026-10-01T00:00:00.000Z'),
    })

    expect(labels(slots)).toEqual([
      '2026-10-25 00:00',
      '2026-10-25 01:00',
      '2026-10-25 02:00',
      '2026-10-25 03:00',
      '2026-10-25 04:00',
      '2026-10-25 05:00',
    ])
  })

  it('a nyári és a téli időszámítás alatt is ugyanaz a helyi kezdés', () => {
    const winter = generateSlots({
      eventType: eventType({ durationMin: 60 }),
      windows: [{ date: '2026-01-15', startMin: 9 * 60, endMin: 10 * 60 }],
      bookings: [],
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const summer = generateSlots({
      eventType: eventType({ durationMin: 60 }),
      windows: [{ date: '2026-07-15', startMin: 9 * 60, endMin: 10 * 60 }],
      bookings: [],
      now: new Date('2026-07-01T00:00:00.000Z'),
    })

    expect(winter[0].startsAt.toISOString()).toBe('2026-01-15T08:00:00.000Z') // UTC+1
    expect(summer[0].startsAt.toISOString()).toBe('2026-07-15T07:00:00.000Z') // UTC+2
    expect(labels(winter)).toEqual(['2026-01-15 09:00'])
    expect(labels(summer)).toEqual(['2026-07-15 09:00'])
  })
})
