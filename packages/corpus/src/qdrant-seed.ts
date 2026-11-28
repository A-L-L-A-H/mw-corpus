import { createHash } from 'node:crypto';
import { ASMAUL_HUSNA_DATASET, type AsmaulHusnaEntry } from './asmaul-husna.js';
import { QdrantClient, type Point } from './qdrant-client.js';

export type RevelationPeriod = 'Meccan' | 'Medinan';

export interface SurahMetadataEntry {
  readonly surahNumber: number;
  readonly arabicName: string;
  readonly transliteration: string;
  readonly englishTitle: string;
  readonly ayahCount: number;
  readonly revelationPeriod: RevelationPeriod;
}

export interface EpistemicSeedPoint extends Point {
  readonly id: string;
  readonly vector: number[];
  readonly payload: {
    readonly kind: 'surah_index' | 'asmaul_husna';
    readonly epistemicLayer: 'source_text' | 'concept_graph';
    readonly locator: string;
    readonly title: string;
    readonly arabic: string;
    readonly sha256: string;
    readonly metadata: Record<string, unknown>;
  };
}

export interface QdrantSeedReport {
  readonly collection: string;
  readonly dimension: number;
  readonly surahCount: number;
  readonly asmaulHusnaCount: number;
  readonly totalPoints: number;
  readonly merkleDigestSha256: string;
  readonly points: readonly EpistemicSeedPoint[];
}

export const QURAN_SURAH_INDEX: readonly SurahMetadataEntry[] = Object.freeze([
  { surahNumber: 1, arabicName: 'الفاتحة', transliteration: 'Al-Fatihah', englishTitle: 'The Opening', ayahCount: 7, revelationPeriod: 'Meccan' },
  { surahNumber: 2, arabicName: 'البقرة', transliteration: 'Al-Baqarah', englishTitle: 'The Cow', ayahCount: 286, revelationPeriod: 'Medinan' },
  { surahNumber: 3, arabicName: 'آل عمران', transliteration: 'Ali Imran', englishTitle: 'Family of Imran', ayahCount: 200, revelationPeriod: 'Medinan' },
  { surahNumber: 4, arabicName: 'النساء', transliteration: 'An-Nisa', englishTitle: 'The Women', ayahCount: 176, revelationPeriod: 'Medinan' },
  { surahNumber: 5, arabicName: 'المائدة', transliteration: 'Al-Maidah', englishTitle: 'The Table Spread', ayahCount: 120, revelationPeriod: 'Medinan' },
  { surahNumber: 6, arabicName: 'الأنعام', transliteration: 'Al-Anam', englishTitle: 'The Cattle', ayahCount: 165, revelationPeriod: 'Meccan' },
  { surahNumber: 7, arabicName: 'الأعراف', transliteration: 'Al-Araf', englishTitle: 'The Heights', ayahCount: 206, revelationPeriod: 'Meccan' },
  { surahNumber: 8, arabicName: 'الأنفال', transliteration: 'Al-Anfal', englishTitle: 'The Spoils of War', ayahCount: 75, revelationPeriod: 'Medinan' },
  { surahNumber: 9, arabicName: 'التوبة', transliteration: 'At-Tawbah', englishTitle: 'The Repentance', ayahCount: 129, revelationPeriod: 'Medinan' },
  { surahNumber: 10, arabicName: 'يونس', transliteration: 'Yunus', englishTitle: 'Jonah', ayahCount: 109, revelationPeriod: 'Meccan' },
  { surahNumber: 11, arabicName: 'هود', transliteration: 'Hud', englishTitle: 'Hud', ayahCount: 123, revelationPeriod: 'Meccan' },
  { surahNumber: 12, arabicName: 'يوسف', transliteration: 'Yusuf', englishTitle: 'Joseph', ayahCount: 111, revelationPeriod: 'Meccan' },
  { surahNumber: 13, arabicName: 'الرعد', transliteration: 'Ar-Rad', englishTitle: 'The Thunder', ayahCount: 43, revelationPeriod: 'Medinan' },
  { surahNumber: 14, arabicName: 'إبراهيم', transliteration: 'Ibrahim', englishTitle: 'Abraham', ayahCount: 52, revelationPeriod: 'Meccan' },
  { surahNumber: 15, arabicName: 'الحجر', transliteration: 'Al-Hijr', englishTitle: 'The Rocky Tract', ayahCount: 99, revelationPeriod: 'Meccan' },
  { surahNumber: 16, arabicName: 'النحل', transliteration: 'An-Nahl', englishTitle: 'The Bee', ayahCount: 128, revelationPeriod: 'Meccan' },
  { surahNumber: 17, arabicName: 'الإسراء', transliteration: 'Al-Isra', englishTitle: 'The Night Journey', ayahCount: 111, revelationPeriod: 'Meccan' },
  { surahNumber: 18, arabicName: 'الكهف', transliteration: 'Al-Kahf', englishTitle: 'The Cave', ayahCount: 110, revelationPeriod: 'Meccan' },
  { surahNumber: 19, arabicName: 'مريم', transliteration: 'Maryam', englishTitle: 'Mary', ayahCount: 98, revelationPeriod: 'Meccan' },
  { surahNumber: 20, arabicName: 'طه', transliteration: 'Ta-Ha', englishTitle: 'Ta-Ha', ayahCount: 135, revelationPeriod: 'Meccan' },
  { surahNumber: 21, arabicName: 'الأنبياء', transliteration: 'Al-Anbiya', englishTitle: 'The Prophets', ayahCount: 112, revelationPeriod: 'Meccan' },
  { surahNumber: 22, arabicName: 'الحج', transliteration: 'Al-Hajj', englishTitle: 'The Pilgrimage', ayahCount: 78, revelationPeriod: 'Medinan' },
  { surahNumber: 23, arabicName: 'المؤمنون', transliteration: 'Al-Muminun', englishTitle: 'The Believers', ayahCount: 118, revelationPeriod: 'Meccan' },
  { surahNumber: 24, arabicName: 'النور', transliteration: 'An-Nur', englishTitle: 'The Light', ayahCount: 64, revelationPeriod: 'Medinan' },
  { surahNumber: 25, arabicName: 'الفرقان', transliteration: 'Al-Furqan', englishTitle: 'The Criterion', ayahCount: 77, revelationPeriod: 'Meccan' },
  { surahNumber: 26, arabicName: 'الشعراء', transliteration: 'Ash-Shuara', englishTitle: 'The Poets', ayahCount: 227, revelationPeriod: 'Meccan' },
  { surahNumber: 27, arabicName: 'النمل', transliteration: 'An-Naml', englishTitle: 'The Ant', ayahCount: 93, revelationPeriod: 'Meccan' },
  { surahNumber: 28, arabicName: 'القصص', transliteration: 'Al-Qasas', englishTitle: 'The Stories', ayahCount: 88, revelationPeriod: 'Meccan' },
  { surahNumber: 29, arabicName: 'العنكبوت', transliteration: 'Al-Ankabut', englishTitle: 'The Spider', ayahCount: 69, revelationPeriod: 'Meccan' },
  { surahNumber: 30, arabicName: 'الروم', transliteration: 'Ar-Rum', englishTitle: 'The Romans', ayahCount: 60, revelationPeriod: 'Meccan' },
  { surahNumber: 31, arabicName: 'لقمان', transliteration: 'Luqman', englishTitle: 'Luqman', ayahCount: 34, revelationPeriod: 'Meccan' },
  { surahNumber: 32, arabicName: 'السجدة', transliteration: 'As-Sajdah', englishTitle: 'The Prostration', ayahCount: 30, revelationPeriod: 'Meccan' },
  { surahNumber: 33, arabicName: 'الأحزاب', transliteration: 'Al-Ahzab', englishTitle: 'The Combined Forces', ayahCount: 73, revelationPeriod: 'Medinan' },
  { surahNumber: 34, arabicName: 'سبأ', transliteration: 'Saba', englishTitle: 'Sheba', ayahCount: 54, revelationPeriod: 'Meccan' },
  { surahNumber: 35, arabicName: 'فاطر', transliteration: 'Fatir', englishTitle: 'Originator', ayahCount: 45, revelationPeriod: 'Meccan' },
  { surahNumber: 36, arabicName: 'يس', transliteration: 'Ya-Sin', englishTitle: 'Ya Sin', ayahCount: 83, revelationPeriod: 'Meccan' },
  { surahNumber: 37, arabicName: 'الصافات', transliteration: 'As-Saffat', englishTitle: 'Those Who Set The Ranks', ayahCount: 182, revelationPeriod: 'Meccan' },
  { surahNumber: 38, arabicName: 'ص', transliteration: 'Sad', englishTitle: 'The Letter Sad', ayahCount: 88, revelationPeriod: 'Meccan' },
  { surahNumber: 39, arabicName: 'الزمر', transliteration: 'Az-Zumar', englishTitle: 'The Troops', ayahCount: 75, revelationPeriod: 'Meccan' },
  { surahNumber: 40, arabicName: 'غافر', transliteration: 'Ghafir', englishTitle: 'The Forgiver', ayahCount: 85, revelationPeriod: 'Meccan' },
  { surahNumber: 41, arabicName: 'فصلت', transliteration: 'Fussilat', englishTitle: 'Explained in Detail', ayahCount: 54, revelationPeriod: 'Meccan' },
  { surahNumber: 42, arabicName: 'الشورى', transliteration: 'Ash-Shura', englishTitle: 'The Consultation', ayahCount: 53, revelationPeriod: 'Meccan' },
  { surahNumber: 43, arabicName: 'الزخرف', transliteration: 'Az-Zukhruf', englishTitle: 'The Ornaments of Gold', ayahCount: 89, revelationPeriod: 'Meccan' },
  { surahNumber: 44, arabicName: 'الدخان', transliteration: 'Ad-Dukhan', englishTitle: 'The Smoke', ayahCount: 59, revelationPeriod: 'Meccan' },
  { surahNumber: 45, arabicName: 'الجاثية', transliteration: 'Al-Jathiyah', englishTitle: 'The Crouching', ayahCount: 37, revelationPeriod: 'Meccan' },
  { surahNumber: 46, arabicName: 'الأحقاف', transliteration: 'Al-Ahqaf', englishTitle: 'The Wind-Curved Sandhills', ayahCount: 35, revelationPeriod: 'Meccan' },
  { surahNumber: 47, arabicName: 'محمد', transliteration: 'Muhammad', englishTitle: 'Muhammad', ayahCount: 38, revelationPeriod: 'Medinan' },
  { surahNumber: 48, arabicName: 'الفتح', transliteration: 'Al-Fath', englishTitle: 'The Victory', ayahCount: 29, revelationPeriod: 'Medinan' },
  { surahNumber: 49, arabicName: 'الحجرات', transliteration: 'Al-Hujurat', englishTitle: 'The Rooms', ayahCount: 18, revelationPeriod: 'Medinan' },
  { surahNumber: 50, arabicName: 'ق', transliteration: 'Qaf', englishTitle: 'The Letter Qaf', ayahCount: 45, revelationPeriod: 'Meccan' },
  { surahNumber: 51, arabicName: 'الذاريات', transliteration: 'Adh-Dhariyat', englishTitle: 'The Winnowing Winds', ayahCount: 60, revelationPeriod: 'Meccan' },
  { surahNumber: 52, arabicName: 'الطور', transliteration: 'At-Tur', englishTitle: 'The Mount', ayahCount: 49, revelationPeriod: 'Meccan' },
  { surahNumber: 53, arabicName: 'النجم', transliteration: 'An-Najm', englishTitle: 'The Star', ayahCount: 62, revelationPeriod: 'Meccan' },
  { surahNumber: 54, arabicName: 'القمر', transliteration: 'Al-Qamar', englishTitle: 'The Moon', ayahCount: 55, revelationPeriod: 'Meccan' },
  { surahNumber: 55, arabicName: 'الرحمن', transliteration: 'Ar-Rahman', englishTitle: 'The Beneficent', ayahCount: 78, revelationPeriod: 'Medinan' },
  { surahNumber: 56, arabicName: 'الواقعة', transliteration: 'Al-Waqiah', englishTitle: 'The Inevitable', ayahCount: 96, revelationPeriod: 'Meccan' },
  { surahNumber: 57, arabicName: 'الحديد', transliteration: 'Al-Hadid', englishTitle: 'The Iron', ayahCount: 29, revelationPeriod: 'Medinan' },
  { surahNumber: 58, arabicName: 'المجادلة', transliteration: 'Al-Mujadila', englishTitle: 'The Pleading Woman', ayahCount: 22, revelationPeriod: 'Medinan' },
  { surahNumber: 59, arabicName: 'الحشر', transliteration: 'Al-Hashr', englishTitle: 'The Exile', ayahCount: 24, revelationPeriod: 'Medinan' },
  { surahNumber: 60, arabicName: 'الممتحنة', transliteration: 'Al-Mumtahanah', englishTitle: 'She That Is To Be Examined', ayahCount: 13, revelationPeriod: 'Medinan' },
  { surahNumber: 61, arabicName: 'الصف', transliteration: 'As-Saff', englishTitle: 'The Ranks', ayahCount: 14, revelationPeriod: 'Medinan' },
  { surahNumber: 62, arabicName: 'الجمعة', transliteration: 'Al-Jumuah', englishTitle: 'The Congregation', ayahCount: 11, revelationPeriod: 'Medinan' },
  { surahNumber: 63, arabicName: 'المنافقون', transliteration: 'Al-Munafiqun', englishTitle: 'The Hypocrites', ayahCount: 11, revelationPeriod: 'Medinan' },
  { surahNumber: 64, arabicName: 'التغابن', transliteration: 'At-Taghabun', englishTitle: 'The Mutual Disillusion', ayahCount: 18, revelationPeriod: 'Medinan' },
  { surahNumber: 65, arabicName: 'الطلاق', transliteration: 'At-Talaq', englishTitle: 'The Divorce', ayahCount: 12, revelationPeriod: 'Medinan' },
  { surahNumber: 66, arabicName: 'التحريم', transliteration: 'At-Tahrim', englishTitle: 'The Prohibition', ayahCount: 12, revelationPeriod: 'Medinan' },
  { surahNumber: 67, arabicName: 'الملك', transliteration: 'Al-Mulk', englishTitle: 'The Sovereignty', ayahCount: 30, revelationPeriod: 'Meccan' },
  { surahNumber: 68, arabicName: 'القلم', transliteration: 'Al-Qalam', englishTitle: 'The Pen', ayahCount: 52, revelationPeriod: 'Meccan' },
  { surahNumber: 69, arabicName: 'الحاقة', transliteration: 'Al-Haqqah', englishTitle: 'The Reality', ayahCount: 52, revelationPeriod: 'Meccan' },
  { surahNumber: 70, arabicName: 'المعارج', transliteration: 'Al-Maarij', englishTitle: 'The Ascending Stairways', ayahCount: 44, revelationPeriod: 'Meccan' },
  { surahNumber: 71, arabicName: 'نوح', transliteration: 'Nuh', englishTitle: 'Noah', ayahCount: 28, revelationPeriod: 'Meccan' },
  { surahNumber: 72, arabicName: 'الجن', transliteration: 'Al-Jinn', englishTitle: 'The Jinn', ayahCount: 28, revelationPeriod: 'Meccan' },
  { surahNumber: 73, arabicName: 'المزمل', transliteration: 'Al-Muzzammil', englishTitle: 'The Enshrouded One', ayahCount: 20, revelationPeriod: 'Meccan' },
  { surahNumber: 74, arabicName: 'المدثر', transliteration: 'Al-Muddaththir', englishTitle: 'The Cloaked One', ayahCount: 56, revelationPeriod: 'Meccan' },
  { surahNumber: 75, arabicName: 'القيامة', transliteration: 'Al-Qiyamah', englishTitle: 'The Resurrection', ayahCount: 40, revelationPeriod: 'Meccan' },
  { surahNumber: 76, arabicName: 'الإنسان', transliteration: 'Al-Insan', englishTitle: 'The Man', ayahCount: 31, revelationPeriod: 'Medinan' },
  { surahNumber: 77, arabicName: 'المرسلات', transliteration: 'Al-Mursalat', englishTitle: 'The Emissaries', ayahCount: 50, revelationPeriod: 'Meccan' },
  { surahNumber: 78, arabicName: 'النبأ', transliteration: 'An-Naba', englishTitle: 'The Tidings', ayahCount: 40, revelationPeriod: 'Meccan' },
  { surahNumber: 79, arabicName: 'النازعات', transliteration: 'An-Naziat', englishTitle: 'Those Who Drag Forth', ayahCount: 46, revelationPeriod: 'Meccan' },
  { surahNumber: 80, arabicName: 'عبس', transliteration: 'Abasa', englishTitle: 'He Frowned', ayahCount: 42, revelationPeriod: 'Meccan' },
  { surahNumber: 81, arabicName: 'التكوير', transliteration: 'At-Takwir', englishTitle: 'The Overthrowing', ayahCount: 29, revelationPeriod: 'Meccan' },
  { surahNumber: 82, arabicName: 'الانفطار', transliteration: 'Al-Infitar', englishTitle: 'The Cleaving', ayahCount: 19, revelationPeriod: 'Meccan' },
  { surahNumber: 83, arabicName: 'المطففين', transliteration: 'Al-Mutaffifin', englishTitle: 'The Defrauding', ayahCount: 36, revelationPeriod: 'Meccan' },
  { surahNumber: 84, arabicName: 'الانشقاق', transliteration: 'Al-Inshiqaq', englishTitle: 'The Sundering', ayahCount: 25, revelationPeriod: 'Meccan' },
  { surahNumber: 85, arabicName: 'البروج', transliteration: 'Al-Buruj', englishTitle: 'The Mansions of the Stars', ayahCount: 22, revelationPeriod: 'Meccan' },
  { surahNumber: 86, arabicName: 'الطارق', transliteration: 'At-Tariq', englishTitle: 'The Morning Star', ayahCount: 17, revelationPeriod: 'Meccan' },
  { surahNumber: 87, arabicName: 'الأعلى', transliteration: 'Al-Ala', englishTitle: 'The Most High', ayahCount: 19, revelationPeriod: 'Meccan' },
  { surahNumber: 88, arabicName: 'الغاشية', transliteration: 'Al-Ghashiyah', englishTitle: 'The Overwhelming', ayahCount: 26, revelationPeriod: 'Meccan' },
  { surahNumber: 89, arabicName: 'الفجر', transliteration: 'Al-Fajr', englishTitle: 'The Dawn', ayahCount: 30, revelationPeriod: 'Meccan' },
  { surahNumber: 90, arabicName: 'البلد', transliteration: 'Al-Balad', englishTitle: 'The City', ayahCount: 20, revelationPeriod: 'Meccan' },
  { surahNumber: 91, arabicName: 'الشمس', transliteration: 'Ash-Shams', englishTitle: 'The Sun', ayahCount: 15, revelationPeriod: 'Meccan' },
  { surahNumber: 92, arabicName: 'الليل', transliteration: 'Al-Layl', englishTitle: 'The Night', ayahCount: 21, revelationPeriod: 'Meccan' },
  { surahNumber: 93, arabicName: 'الضحى', transliteration: 'Ad-Duha', englishTitle: 'The Morning Hours', ayahCount: 11, revelationPeriod: 'Meccan' },
  { surahNumber: 94, arabicName: 'الشرح', transliteration: 'Ash-Sharh', englishTitle: 'The Relief', ayahCount: 8, revelationPeriod: 'Meccan' },
  { surahNumber: 95, arabicName: 'التين', transliteration: 'At-Tin', englishTitle: 'The Fig', ayahCount: 8, revelationPeriod: 'Meccan' },
  { surahNumber: 96, arabicName: 'العلق', transliteration: 'Al-Alaq', englishTitle: 'The Clot', ayahCount: 19, revelationPeriod: 'Meccan' },
  { surahNumber: 97, arabicName: 'القدر', transliteration: 'Al-Qadr', englishTitle: 'The Power', ayahCount: 5, revelationPeriod: 'Meccan' },
  { surahNumber: 98, arabicName: 'البينة', transliteration: 'Al-Bayyinah', englishTitle: 'The Clear Proof', ayahCount: 8, revelationPeriod: 'Medinan' },
  { surahNumber: 99, arabicName: 'الزلزلة', transliteration: 'Az-Zalzalah', englishTitle: 'The Earthquake', ayahCount: 8, revelationPeriod: 'Medinan' },
  { surahNumber: 100, arabicName: 'العاديات', transliteration: 'Al-Adiyat', englishTitle: 'The Courser', ayahCount: 11, revelationPeriod: 'Meccan' },
  { surahNumber: 101, arabicName: 'القارعة', transliteration: 'Al-Qariah', englishTitle: 'The Calamity', ayahCount: 11, revelationPeriod: 'Meccan' },
  { surahNumber: 102, arabicName: 'التكاثر', transliteration: 'At-Takathur', englishTitle: 'The Rivalry in World Increase', ayahCount: 8, revelationPeriod: 'Meccan' },
  { surahNumber: 103, arabicName: 'العصر', transliteration: 'Al-Asr', englishTitle: 'The Declining Day', ayahCount: 3, revelationPeriod: 'Meccan' },
  { surahNumber: 104, arabicName: 'الهمزة', transliteration: 'Al-Humazah', englishTitle: 'The Traducer', ayahCount: 9, revelationPeriod: 'Meccan' },
  { surahNumber: 105, arabicName: 'الفيل', transliteration: 'Al-Fil', englishTitle: 'The Elephant', ayahCount: 5, revelationPeriod: 'Meccan' },
  { surahNumber: 106, arabicName: 'قريش', transliteration: 'Quraysh', englishTitle: 'Quraysh', ayahCount: 4, revelationPeriod: 'Meccan' },
  { surahNumber: 107, arabicName: 'الماعون', transliteration: 'Al-Maun', englishTitle: 'The Small Kindnesses', ayahCount: 7, revelationPeriod: 'Meccan' },
  { surahNumber: 108, arabicName: 'الكوثر', transliteration: 'Al-Kawthar', englishTitle: 'The Abundance', ayahCount: 3, revelationPeriod: 'Meccan' },
  { surahNumber: 109, arabicName: 'الكافرون', transliteration: 'Al-Kafirun', englishTitle: 'The Disbelievers', ayahCount: 6, revelationPeriod: 'Meccan' },
  { surahNumber: 110, arabicName: 'النصر', transliteration: 'An-Nasr', englishTitle: 'The Divine Support', ayahCount: 3, revelationPeriod: 'Medinan' },
  { surahNumber: 111, arabicName: 'المسد', transliteration: 'Al-Masad', englishTitle: 'The Palm Fiber', ayahCount: 5, revelationPeriod: 'Meccan' },
  { surahNumber: 112, arabicName: 'الإخلاص', transliteration: 'Al-Ikhlas', englishTitle: 'The Sincerity', ayahCount: 4, revelationPeriod: 'Meccan' },
  { surahNumber: 113, arabicName: 'الفلق', transliteration: 'Al-Falaq', englishTitle: 'The Daybreak', ayahCount: 5, revelationPeriod: 'Meccan' },
  { surahNumber: 114, arabicName: 'الناس', transliteration: 'An-Nas', englishTitle: 'Mankind', ayahCount: 6, revelationPeriod: 'Meccan' },
]);

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Generates an offline deterministic unit-length embedding vector from canonical text.
 * Uses chained SHA-256 blocks to ensure cross-platform reproducibility without external API calls.
 */
export function computeDeterministicEmbedding(text: string, dimension: number = 16): number[] {
  if (!Number.isInteger(dimension) || dimension <= 0 || dimension > 512) {
    throw new RangeError('dimension must be an integer between 1 and 512');
  }
  const rawValues: number[] = [];
  let blockIndex = 0;
  while (rawValues.length < dimension) {
    const digest = createHash('sha256')
      .update(`${blockIndex}:${text.trim().toLowerCase()}`, 'utf8')
      .digest();
    for (let offset = 0; offset + 1 < digest.length && rawValues.length < dimension; offset += 2) {
      const uint16 = (digest[offset]! << 8) | digest[offset + 1]!;
      const centered = (uint16 / 32767.5) - 1.0;
      rawValues.push(centered);
    }
    blockIndex += 1;
  }

  const norm = Math.sqrt(rawValues.reduce((acc, v) => acc + v * v, 0));
  if (norm === 0) {
    return rawValues.map((_, idx) => (idx === 0 ? 1 : 0));
  }
  return rawValues.map((v) => Number((v / norm).toFixed(6)));
}

function buildSurahSeedPoint(entry: SurahMetadataEntry, dimension: number): EpistemicSeedPoint {
  const locator = `Q${entry.surahNumber}`;
  const canonicalPayload = JSON.stringify({
    kind: 'surah_index',
    surahNumber: entry.surahNumber,
    arabicName: entry.arabicName,
    transliteration: entry.transliteration,
    englishTitle: entry.englishTitle,
    ayahCount: entry.ayahCount,
    revelationPeriod: entry.revelationPeriod,
  });
  const digest = sha256Hex(canonicalPayload);
  const embeddingSource = `${locator} ${entry.arabicName} ${entry.transliteration} ${entry.englishTitle} ${entry.revelationPeriod}`;

  return {
    id: `mw:surah:${entry.surahNumber}`,
    vector: computeDeterministicEmbedding(embeddingSource, dimension),
    payload: {
      kind: 'surah_index',
      epistemicLayer: 'source_text',
      locator,
      title: `${entry.transliteration} (${entry.englishTitle})`,
      arabic: entry.arabicName,
      sha256: digest,
      metadata: {
        surahNumber: entry.surahNumber,
        transliteration: entry.transliteration,
        englishTitle: entry.englishTitle,
        ayahCount: entry.ayahCount,
        revelationPeriod: entry.revelationPeriod,
      },
    },
  };
}

function buildAsmaulHusnaSeedPoint(entry: AsmaulHusnaEntry, dimension: number): EpistemicSeedPoint {
  const locator = `AH:${entry.ordinal}`;
  const canonicalPayload = JSON.stringify({
    kind: 'asmaul_husna',
    ordinal: entry.ordinal,
    arabic: entry.arabic,
    transliteration: entry.transliteration,
    meaningEn: entry.meaningEn,
    meaningId: entry.meaningId,
    cluster: entry.cluster,
  });
  const digest = sha256Hex(canonicalPayload);
  const embeddingSource = `${locator} ${entry.arabic} ${entry.transliteration} ${entry.meaningEn} ${entry.meaningId} ${entry.cluster}`;

  return {
    id: `mw:asmaul-husna:${entry.ordinal}`,
    vector: computeDeterministicEmbedding(embeddingSource, dimension),
    payload: {
      kind: 'asmaul_husna',
      epistemicLayer: 'concept_graph',
      locator,
      title: `${entry.transliteration} (${entry.meaningEn})`,
      arabic: entry.arabic,
      sha256: digest,
      metadata: {
        ordinal: entry.ordinal,
        transliteration: entry.transliteration,
        meaningEn: entry.meaningEn,
        meaningId: entry.meaningId,
        cluster: entry.cluster,
      },
    },
  };
}

export function generateEpistemicSeedPoints(options: { dimension?: number } = {}): EpistemicSeedPoint[] {
  const dimension = options.dimension ?? 16;
  const surahPoints = QURAN_SURAH_INDEX.map((surah) => buildSurahSeedPoint(surah, dimension));
  const asmaPoints = ASMAUL_HUSNA_DATASET.map((asma) => buildAsmaulHusnaSeedPoint(asma, dimension));
  return [...surahPoints, ...asmaPoints];
}

export async function seedQdrantEpistemicCorpus(options: {
  client?: QdrantClient;
  collection?: string;
  dimension?: number;
} = {}): Promise<QdrantSeedReport> {
  const client = options.client ?? new QdrantClient();
  const collection = options.collection ?? 'mw-epistemic-seed';
  const dimension = options.dimension ?? 16;
  const points = generateEpistemicSeedPoints({ dimension });

  await client.upsert(collection, points);

  const merkleInput = points.map((p) => `${p.id}:${p.payload.sha256}`).join('|');
  const merkleDigestSha256 = sha256Hex(merkleInput);

  return {
    collection,
    dimension,
    surahCount: QURAN_SURAH_INDEX.length,
    asmaulHusnaCount: ASMAUL_HUSNA_DATASET.length,
    totalPoints: points.length,
    merkleDigestSha256,
    points,
  };
}
