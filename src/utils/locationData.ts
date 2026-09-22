import { District } from '../types';

export interface LocationState {
  stateName: string;
  stateId: string;
  districts: {
    name: string;
    target: number;
    blocks: string[];
  }[];
}

export const MASTER_LOCATION_DATA: LocationState[] = [
  {
    stateName: 'Meghalaya',
    stateId: 'st-meghalaya',
    districts: [
      {
        name: 'East Khasi Hills',
        target: 50,
        blocks: [
          'Mylliem',
          'Mawphlang',
          'Khatarshnong Laitkroh',
          'Pynursla',
          'Mawkynrew',
          'Mawryngkneng',
          'Shella Bholaganj',
          'Bhoirymbong',
          'Shillong Sadar',
        ],
      },
      {
        name: 'West Khasi Hills',
        target: 40,
        blocks: ['Nongstoin', 'Mawshynrut', 'Rambrai'],
      },
      {
        name: 'South West Khasi Hills',
        target: 35,
        blocks: ['Mawkyrwat', 'Ranikor'],
      },
      {
        name: 'Eastern West Khasi Hills',
        target: 35,
        blocks: ['Mairang', 'Mawthadraishan'],
      },
      {
        name: 'Ri-Bhoi',
        target: 45,
        blocks: ['Umsning', 'Umling', 'Jirang', 'Bhoirymbong'],
      },
      {
        name: 'West Garo Hills',
        target: 45,
        blocks: ['Rongram', 'Dadenggre', 'Tikrikilla', 'Selsella', 'Dalu', 'Gambegre', 'Demdema'],
      },
      {
        name: 'East Garo Hills',
        target: 35,
        blocks: ['Samanda', 'Songsak', 'Dambo Rongjeng'],
      },
      {
        name: 'South Garo Hills',
        target: 30,
        blocks: ['Baghmara', 'Chokpot', 'Gasuapara', 'Ronggara'],
      },
      {
        name: 'North Garo Hills',
        target: 35,
        blocks: ['Resubelpara', 'Bajengdoba', 'Kharkutta'],
      },
      {
        name: 'South West Garo Hills',
        target: 30,
        blocks: ['Betasing', 'Zikzak'],
      },
      {
        name: 'West Jaintia Hills',
        target: 40,
        blocks: ['Thadlaskein', 'Laskein', 'Amlarem'],
      },
      {
        name: 'East Jaintia Hills',
        target: 35,
        blocks: ['Khliehriat', 'Saipung'],
      },
    ],
  },
  {
    stateName: 'Nagaland',
    stateId: 'st-nagaland',
    districts: [
      {
        name: 'Dimapur',
        target: 50,
        blocks: ['Chumukedima', 'Medziphema', 'Niuland', 'Dhansiripar'],
      },
      {
        name: 'Kohima',
        target: 45,
        blocks: ['Kohima Sadar', 'Jakhama', 'Sechu Zubza', 'Chiephobozou', 'Tseminyu'],
      },
      {
        name: 'Mokokchung',
        target: 40,
        blocks: ['Ongpangkong North', 'Ongpangkong South', 'Kobulong', 'Changtongya', 'Mangkolemba'],
      },
      {
        name: 'Mon',
        target: 35,
        blocks: ['Mon Sadar', 'Chen', 'Tizit', 'Tobu', 'Aboi', 'Naginimora'],
      },
      {
        name: 'Tuensang',
        target: 30,
        blocks: ['Tuensang Sadar', 'Noksen', 'Longkhim', 'Shamator'],
      },
      {
        name: 'Wokha',
        target: 35,
        blocks: ['Wokha Sadar', 'Sanis', 'Bhandari', 'Ralan', 'Chukitong'],
      },
      {
        name: 'Zunheboto',
        target: 35,
        blocks: ['Zunheboto Sadar', 'Akuluto', 'Suruhuto', 'Aghunato', 'Satakha'],
      },
      {
        name: 'Phek',
        target: 35,
        blocks: ['Phek Sadar', 'Pfutsero', 'Meluri', 'Chozuba'],
      },
      {
        name: 'Peren',
        target: 30,
        blocks: ['Peren Sadar', 'Jalukie', 'Tening', 'Athibung'],
      },
      {
        name: 'Longleng',
        target: 25,
        blocks: ['Longleng Sadar', 'Tamlu', 'Sakshi'],
      },
      {
        name: 'Kiphire',
        target: 25,
        blocks: ['Kiphire Sadar', 'Pungro', 'Seyochung'],
      },
      {
        name: 'Chumoukedima',
        target: 40,
        blocks: ['Chumoukedima Sadar', 'Medziphema', 'Dhansiripar'],
      },
    ],
  },
  {
    stateName: 'Assam',
    stateId: 'st-assam',
    districts: [
      {
        name: 'Kamrup Metropolitan',
        target: 50,
        blocks: ['Guwahati', 'Dispur', 'Chandrapur', 'Sonapur', 'Azara'],
      },
      {
        name: 'Kamrup',
        target: 45,
        blocks: ['Hajo', 'Boko', 'Chaygaon', 'Rangia', 'Kamalpur', 'Sualkuchi'],
      },
      {
        name: 'Dibrugarh',
        target: 45,
        blocks: ['Dibrugarh Sadar', 'Tingkhong', 'Joypur', 'Khowang', 'Naharkatiya', 'Barbaruah'],
      },
      {
        name: 'Jorhat',
        target: 40,
        blocks: ['Jorhat Central', 'Titabor', 'Teok', 'Mariani', 'North West Jorhat'],
      },
      {
        name: 'Golaghat',
        target: 40,
        blocks: ['Golaghat Sadar', 'Bokakhat', 'Sarupathar', 'Morongi', 'Gomariguri'],
      },
      {
        name: 'Cachar',
        target: 45,
        blocks: ['Silchar', 'Sonai', 'Lakhipur', 'Katigorah', 'Udarbond', 'Borkhola'],
      },
      {
        name: 'Nagaon',
        target: 45,
        blocks: ['Nagaon Sadar', 'Kaliabor', 'Raha', 'Rupahihat', 'Batadrava', 'Barhampur'],
      },
      {
        name: 'Sonitpur',
        target: 40,
        blocks: ['Tezpur', 'Dhekiajuli', 'Naduar', 'Balipara', 'Gabharu'],
      },
    ],
  },
  {
    stateName: 'Manipur',
    stateId: 'st-manipur',
    districts: [
      {
        name: 'Imphal West',
        target: 40,
        blocks: ['Lamphelpat', 'Patsoi', 'Wangoi', 'Lamsang'],
      },
      {
        name: 'Imphal East',
        target: 40,
        blocks: ['Porompat', 'Keirao Bitra', 'Sawombung'],
      },
      {
        name: 'Bishnupur',
        target: 35,
        blocks: ['Bishnupur Sadar', 'Moirang', 'Nambol'],
      },
      {
        name: 'Thoubal',
        target: 35,
        blocks: ['Thoubal Sadar', 'Lilong', 'Kakching'],
      },
      {
        name: 'Churachandpur',
        target: 35,
        blocks: ['Churachandpur Sadar', 'Singngat', 'Thanlon', 'Samulamlan'],
      },
    ],
  },
];

/**
 * Returns list of all available states
 */
export function getAllStates(): string[] {
  return MASTER_LOCATION_DATA.map((s) => s.stateName);
}

/**
 * Returns all districts belonging to a specific state (case-insensitive)
 */
export function getDistrictsForState(stateName: string): string[] {
  if (!stateName || stateName.toLowerCase() === 'all') {
    return Array.from(
      new Set(
        MASTER_LOCATION_DATA.flatMap((s) => s.districts.map((d) => d.name))
      )
    );
  }

  const cleanState = stateName.trim().toLowerCase();
  const stateObj = MASTER_LOCATION_DATA.find(
    (s) => s.stateName.trim().toLowerCase() === cleanState
  );

  return stateObj ? stateObj.districts.map((d) => d.name) : [];
}

/**
 * Normalizes string for loose comparison (lowercase, trimmed, collapsed whitespace)
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Finds all blocks for a given district.
 * Searches with case-insensitivity and whitespace tolerance.
 * If stateName is provided, searches that state first; otherwise searches across all states.
 */
export function getBlocksForDistrict(districtName: string, stateName?: string): string[] {
  if (!districtName || districtName.toLowerCase() === 'all') {
    return Array.from(
      new Set(
        MASTER_LOCATION_DATA.flatMap((s) =>
          s.districts.flatMap((d) => d.blocks)
        )
      )
    );
  }

  const cleanDistrict = normalizeName(districtName);

  // If stateName is provided, search inside that state
  if (stateName && stateName.toLowerCase() !== 'all') {
    const cleanState = normalizeName(stateName);
    const stateObj = MASTER_LOCATION_DATA.find(
      (s) => normalizeName(s.stateName) === cleanState
    );
    if (stateObj) {
      const distObj = stateObj.districts.find(
        (d) => normalizeName(d.name) === cleanDistrict
      );
      if (distObj) {
        return distObj.blocks;
      }
    }
  }

  // Search across all states
  for (const stateObj of MASTER_LOCATION_DATA) {
    const distObj = stateObj.districts.find(
      (d) => normalizeName(d.name) === cleanDistrict
    );
    if (distObj) {
      return distObj.blocks;
    }
  }

  return [];
}

/**
 * Returns the state name for a given district
 */
export function getStateForDistrict(districtName: string): string | null {
  const cleanDistrict = normalizeName(districtName);
  for (const stateObj of MASTER_LOCATION_DATA) {
    const found = stateObj.districts.some(
      (d) => normalizeName(d.name) === cleanDistrict
    );
    if (found) {
      return stateObj.stateName;
    }
  }
  return null;
}

/**
 * Flattens master data into District objects matching types.ts District interface
 */
export function getMasterDistrictsList(): District[] {
  let idCounter = 1;
  const list: District[] = [];

  for (const state of MASTER_LOCATION_DATA) {
    for (const d of state.districts) {
      list.push({
        id: `dist-${idCounter++}`,
        stateId: state.stateId,
        stateName: state.stateName,
        name: d.name,
        target: d.target,
        blocks: d.blocks,
      });
    }
  }

  return list;
}

/**
 * Guarantees that any stored districts array contains all master districts
 * and that each district has its full, accurate block list.
 */
export function mergeDistrictsWithMaster(storedDistricts: District[]): District[] {
  const master = getMasterDistrictsList();
  const districtMap = new Map<string, District>();

  // Load existing stored districts
  for (const d of storedDistricts) {
    districtMap.set(normalizeName(d.name), d);
  }

  // Merge or add master districts ensuring block arrays are complete
  for (const m of master) {
    const key = normalizeName(m.name);
    const existing = districtMap.get(key);

    if (!existing) {
      districtMap.set(key, m);
    } else {
      // Ensure stateName, stateId, and blocks are updated/present
      const mergedBlocks = Array.from(new Set([...m.blocks, ...(existing.blocks || [])]));
      districtMap.set(key, {
        ...existing,
        stateName: existing.stateName || m.stateName,
        stateId: existing.stateId || m.stateId,
        blocks: mergedBlocks,
        target: existing.target || m.target,
      });
    }
  }

  return Array.from(districtMap.values());
}
