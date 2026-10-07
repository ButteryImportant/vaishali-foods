/**
 * Delhivery Surface shipping, calculated offline from a zone rate table.
 *
 * Origin: Nanded, Maharashtra 431605 (override with the PICKUP_PINCODE env var).
 *
 * Zones (Delhivery's rulebook):
 *   A - Local: pickup and delivery within the same city.
 *   B - Regional: destination within roughly 500 km of origin.
 *   C - Metro to Metro (both ends in a metro city).
 *   D - Rest of India.
 *   E - Special zones: Jammu, Himachal Pradesh, North East (excl. Manipur).
 *   F - Special zones: Kashmir, Manipur, Ladakh, Andaman & Nicobar.
 *
 * Rate table (Delhivery Surface, 500 g to 1.5 kg):
 *   base       = fare for the first 500 g (or part thereof)
 *   additional = fare for every further 500 g slab (or part thereof)
 * Beyond 1.5 kg the same additional-slab rate keeps applying per 500 g.
 * The final amount is rounded UP to the next whole rupee for checkout.
 *
 * NOTE on Zone B: without a live distance database, "within 500 km" is
 * approximated with postal-circle prefixes around Nanded (Marathwada,
 * rest of Maharashtra excl. Mumbai, Telangana, nearby AP/Karnataka/MP
 * districts). If Delhivery ever bills a nearby destination under a
 * different zone, adjust ZONE_B_PREFIXES below to match their panel.
 */

export const DEFAULT_ORIGIN_PINCODE = '431605'; // Nanded, Maharashtra

export const DELHIVERY_SURFACE_RATES = {
  A: { base: 35.4, additional: 34.22, label: 'Local - same city' },
  B: { base: 38.94, additional: 37.76, label: 'Regional - within ~500 km' },
  C: { base: 51.92, additional: 49.56, label: 'Metro to Metro' },
  D: { base: 61.36, additional: 57.82, label: 'Rest of India' },
  E: { base: 75.52, additional: 71.98, label: 'Special zone' },
  F: { base: 88.5, additional: 84.96, label: 'Special zone - remote' },
};

const ZONE_ETD_DAYS = {
  A: '1-2 days',
  B: '2-4 days',
  C: '3-5 days',
  D: '4-6 days',
  E: '5-7 days',
  F: '6-8 days',
};

// Metro cities by 3-digit pincode prefix (Zone C needs BOTH ends metro).
const METRO_PREFIXES_3 = [
  '110', // Delhi NCR
  '400', '401', '402', '403', // Mumbai
  '500', // Hyderabad
  '560', // Bengaluru
  '600', '601', // Chennai
  '700', // Kolkata
];

// First-2-digit postal circles treated as within ~500 km of Nanded:
// 41/42/43/44 = Maharashtra (excl. Mumbai 400-403 and Goa), 50 = Telangana.
const ZONE_B_PREFIXES_2 = ['41', '42', '43', '44', '50'];

// Finer 3-digit additions for nearby districts outside those circles:
// 450/451 (Khandwa, Khargone MP), 518/520-523 (Kurnool, Vijayawada belt),
// 584/585/586 (Raichur, Bidar, Vijayapura).
const ZONE_B_PREFIXES_3 = [
  '450', '451',
  '518', '520', '521', '522', '523',
  '584', '585', '586',
];

// Special zones by pincode.
const KASHMIR_LADAKH_FIRST3 = ['190', '191', '192', '193', '194']; // F
const NE_EAST_FIRST3 = [
  '780', '781', '782', '783', '784', '785', '786', '787', '788', // Assam
  '790', '791', '792', // Arunachal Pradesh
  '793', '794', // Meghalaya
  '796', // Mizoram
  '797', '798', // Nagaland
  '799', // Tripura
];

function first(pin, n) {
  return String(pin || '').slice(0, n);
}

function isValidPin(pin) {
  return /^[1-9][0-9]{5}$/.test(String(pin || '').trim());
}

function isMetro(pin) {
  return METRO_PREFIXES_3.includes(first(pin, 3));
}

/**
 * Resolve the Delhivery zone for origin -> destination pincodes.
 * Returns { zone: 'A'..'F', label }.
 */
export function resolveDelhiveryZone(originPin, destPin) {
  const origin = String(originPin || '').trim();
  const dest = String(destPin || '').trim();

  // Zone F - remote special zones (checked before E: Manipur 795 sits
  // inside the 79x North-East range, Ladakh/Kashmir inside 19x).
  if (
    KASHMIR_LADAKH_FIRST3.includes(first(dest, 3)) ||
    dest.startsWith('795') || // Manipur
    dest.startsWith('744') // Andaman & Nicobar
  ) {
    return { zone: 'F', label: DELHIVERY_SURFACE_RATES.F.label };
  }

  // Zone E - Jammu, Himachal, North East (excl. Manipur), Sikkim.
  if (
    first(dest, 2) === '17' || // Himachal Pradesh
    first(dest, 2) === '18' || // Jammu
    dest.startsWith('737') || // Sikkim
    NE_EAST_FIRST3.includes(first(dest, 3))
  ) {
    return { zone: 'E', label: DELHIVERY_SURFACE_RATES.E.label };
  }

  // Zone C - metro to metro (needs both ends metro).
  if (isMetro(origin) && isMetro(dest)) {
    return { zone: 'C', label: DELHIVERY_SURFACE_RATES.C.label };
  }

  // Zone A - same city (same 5-digit locality prefix as origin).
  if (first(dest, 5) === first(origin, 5)) {
    return { zone: 'A', label: DELHIVERY_SURFACE_RATES.A.label };
  }

  // Zone B - regional approximation (see note at top of file).
  if (
    ZONE_B_PREFIXES_2.includes(first(dest, 2)) ||
    ZONE_B_PREFIXES_3.includes(first(dest, 3))
  ) {
    return { zone: 'B', label: DELHIVERY_SURFACE_RATES.B.label };
  }

  // Zone D - rest of India.
  return { zone: 'D', label: DELHIVERY_SURFACE_RATES.D.label };
}

/**
 * Zone-table fare for a chargeable weight.
 * Slabs of 500 g (rounded up): 1 slab = base, each extra slab = additional.
 */
export function getDelhiverySlabRate(zone, chargeableWeightGrams) {
  const table = DELHIVERY_SURFACE_RATES[zone];
  if (!table) throw new Error(`Unknown Delhivery zone "${zone}".`);
  const grams = Math.max(0, Number(chargeableWeightGrams) || 0);
  const slabs = Math.max(1, Math.ceil(grams / 500));
  const amount = table.base + (slabs - 1) * table.additional;
  return { amount, slabs, base: table.base, additional: table.additional };
}

const INCH_TO_CM = 2.54;

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getEstimatedShippingAmount({ providerAmount }) {
  const amount = Number(providerAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.ceil(amount);
}

export function calculateShippingProfile(validatedCart, env) {
  const totalQuantity = validatedCart.reduce(
    (total, item) => total + item.qty,
    0
  );

  const actualWeightGrams = validatedCart.reduce(
    (total, item) => total + item.weightGrams * item.qty,
    0
  );

  const baseHeightInches = 6;
  const scaledHeightInches =
    baseHeightInches * Math.max(1, Math.min(totalQuantity, 4));

  const dimensions = {
    lengthCm: round(9 * INCH_TO_CM),
    breadthCm: round(6 * INCH_TO_CM),
    heightCm: round(scaledHeightInches * INCH_TO_CM)
  };

  const configuredDivisor = Number(env?.DELHIVERY_VOLUMETRIC_DIVISOR);
  const volumetricDivisor =
    Number.isFinite(configuredDivisor) && configuredDivisor > 0
      ? configuredDivisor
      : 5000;

  const volumetricWeightKg =
    (dimensions.lengthCm * dimensions.breadthCm * dimensions.heightCm) /
    volumetricDivisor;

  // Reference only: the store packs dense sweets in small boxes whose
  // volumetric weight stays below the actual scale weight, so slabs are
  // always computed on actual weight (see getShippingQuote).
  const volumetricWeightGrams = Math.ceil(volumetricWeightKg * 1000);

  return {
    carrier: 'delhivery',
    actualWeightGrams,
    volumetricWeightGrams,
    chargeableWeightGrams: actualWeightGrams,
    chargeableWeightKg: round(actualWeightGrams / 1000, 3),
    actualWeightKg: round(actualWeightGrams / 1000, 3),
    dimensions
  };
}

export async function getShippingQuote({
  env,
  validatedCart,
  deliveryPincode,
  orderValue,
  paymentMethod = 'prepaid'
}) {
  void orderValue;
  void paymentMethod;

  const destPin = String(deliveryPincode || '').trim();
  if (!isValidPin(destPin)) {
    throw new Error('Enter a valid 6-digit PIN code.');
  }

  const originPin =
    String(env?.PICKUP_PINCODE || DEFAULT_ORIGIN_PINCODE).trim() ||
    DEFAULT_ORIGIN_PINCODE;

  const profile = calculateShippingProfile(validatedCart, env);
  const { zone, label } = resolveDelhiveryZone(originPin, destPin);
  const slab = getDelhiverySlabRate(zone, profile.chargeableWeightGrams);
  const amount = getEstimatedShippingAmount({ providerAmount: slab.amount });
  const etd = ZONE_ETD_DAYS[zone] || ZONE_ETD_DAYS.D;

  return {
    ...profile,
    originPincode: originPin,
    zone,
    zoneLabel: label,
    slabs: slab.slabs,
    baseFare: slab.base,
    additionalSlab: slab.additional,
    amount,
    carrier: 'delhivery',
    estimateSource: 'delhivery_zone_table',
    courier: {
      id: 'delhivery_surface',
      name: 'Delhivery Surface',
      estimatedDeliveryDays: etd,
      etd: `${etd} (approx.)`
    }
  };
}
