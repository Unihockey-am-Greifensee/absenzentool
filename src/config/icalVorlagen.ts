import type { IcalQuelle } from '../types'

// Bekannte Grizzlys-Kalender (Google-Calendar-Republikationen der kOOL-Feeds).
// «Zuordnen» verbindet sie mit den gleichnamigen Gruppen; fehlende Gruppen
// werden angelegt. Reihenfolge: Wettkampf-Feeds zuerst, damit Spieltage beim
// ersten Anlegen den richtigen Typ erhalten.

const G = 'https://calendar.google.com/calendar/ical/'
const S = '%40import.calendar.google.com/public/basic.ics'

export const ICAL_VORLAGEN: { gruppe: string; quellen: IcalQuelle[] }[] = [
  { gruppe: 'Unihockey U9 FÄLLANDE', quellen: [{ url: `${G}ol4u49kp1tcj6inpqqd85qcatmbse55p${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U9 SCHWERZI', quellen: [{ url: `${G}jdvdja0tksef9h2l1d494icqml2mojas${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U9 VOLKI', quellen: [{ url: `${G}n8mjjcptfpsl6gihfj2qoq4vir6qkgh7${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U11 FÄLLANDE', quellen: [{ url: `${G}fqskjl84kp428sn5nni5aku6vfqu6q5j${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U11 SCHWERZI', quellen: [{ url: `${G}oubqrkavduaefamilo0b9utahrj42pm0${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U13 FÄLLANDE', quellen: [{ url: `${G}r6mfon1p1bo2m4o02n6u7vodcrjkiojk${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U13 SCHWERZI', quellen: [{ url: `${G}dhkvjci8tl3a5mnial3odk2moletsi6m${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U13 FÖRDER', quellen: [{ url: `${G}g4i004kdr5rvqf7ffs2mmvfauvhj20fv${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U16 FÄLLANDE', quellen: [{ url: `${G}ptbialg6uksrq813ok81g1n376vk0li4${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U16 SCHWERZI', quellen: [{ url: `${G}98tjct615ro743rdc7of92f0ihcivs8r${S}`, typ: 'Training' }] },
  { gruppe: 'Unihockey U16 FÖRDER', quellen: [{ url: `${G}7tsi0361jgg5olquqvj2ujh8a8b7mad4${S}`, typ: 'Training' }] },
  {
    gruppe: 'Junioren U18 GF 26/27',
    quellen: [
      { url: `${G}7jud17j8ppaig7hfdikol2uehb8v4d4u${S}`, typ: 'Wettkampf' }, // nur Spieltage
      { url: `${G}65vod6vslbp27fd5sllfpkedq04fv4qj${S}`, typ: 'Training' }, // alle Termine
    ],
  },
  {
    gruppe: 'Herren GF 26/27',
    quellen: [
      { url: `${G}5v4hgsfkusvufmk5vludo1boej94up6k${S}`, typ: 'Wettkampf' }, // nur Spieltage
      { url: `${G}q7i23rh1s1b1un4ghbsilarg8i6sjjma${S}`, typ: 'Training' }, // alle Termine
    ],
  },
]
