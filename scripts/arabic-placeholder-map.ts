/**
 * Restore Arabic script where the QF CSV export saved literal "?" placeholders.
 * The source file has no Arabic codepoints — only transliteration + question marks.
 */
export const ARABIC_PLACEHOLDER_REPLACEMENTS: readonly (readonly [string, string])[] = [
  ['(Al-Masjid al-Aqsa, ?????? ??????)', '(Al-Masjid al-Aqsa, المسجد الأقصى)'],
  ["(Al-Bayt al-Ma'mur, ????? ???????)", "(Al-Bayt al-Ma'mur, البيت المعمور)"],
  ['(Ashab al-Ukhdud, ????? ???????)', '(Ashab al-Ukhdud, أصحاب الأخدود)'],
  ['(Ashab al-Kahf, ????? ?????)', '(Ashab al-Kahf, أصحاب الكهف)'],
  ["(Bay'at al-Ridwan, ???? ???????)", "(Bay'at al-Ridwan, بيعة الرضوان)"],
  ["(Ya'juj and Ma'juj, ????? ??????)", "(Ya'juj and Ma'juj, يأجوج ومأجوج)"],
  ['(Dhul Qarnayn, ?? ???????)', '(Dhul Qarnayn, ذو القرنين)'],
  ['(Ghar Thawr, ??? ???)', '(Ghar Thawr, غار ثور)'],
  ['(Al-Isra, ???????)', '(Al-Isra, الإسراء)'],
  ["(Al-Mi'raj, ???????)", "(Al-Mi'raj, المعراج)"],
  ['(Al-Ahzab, ???????)', '(Al-Ahzab, الأحزاب)'],
  ['(Al-Namus, ???????)', '(Al-Namus, الناموس)'],
  ['(Hijrah, ??????)', '(Hijrah, الهجرة)'],
  ['(Al-Buraq, ??????)', '(Al-Buraq, البراق)'],
  ['(Al-Tawbah, ??????)', '(Al-Tawbah, التوبة)'],
  ['(Hittah, ??????)', '(Hittah, حِطَّة)'],
  ['(tayammum, ??????)', '(tayammum, التيمم)'],
  ['(zakah, ??????)', '(zakah, الزكاة)'],
  ['(Al-Duha, ?????)', '(Al-Duha, الضحى)'],
  ['(Saba, ???)', '(Saba, سبأ)'],
  ['Mount Judi (??????)', 'Mount Judi (Judi, الجودي)'],
  ['Azar (???)', '(Azar, آزر)'],
] as const;

/** Normalize already-patched strings to consistent (English, Arabic) parentheses. */
const ARABIC_FORMAT_NORMALIZATIONS: readonly (readonly [string, string])[] = [
  ['Mount Judi (الجودي)', 'Mount Judi (Judi, الجودي)'],
  ['Azar (آزر)', '(Azar, آزر)'],
  [
    'Al-Masjid al-Haram (Kaaba)',
    'Al-Masjid al-Haram (Al-Masjid al-Haram, المسجد الحرام) (Kaaba, الكعبة)',
  ],
] as const;

export function restoreArabicPlaceholders(text: string): string {
  let out = text;
  for (const [from, to] of ARABIC_PLACEHOLDER_REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  for (const [from, to] of ARABIC_FORMAT_NORMALIZATIONS) {
    out = out.split(from).join(to);
  }
  return out;
}
