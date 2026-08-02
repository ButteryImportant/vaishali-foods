// DEPRECATED — kept only so older imports don't break.
//
// This used to be a second, independent Shiprocket client with its own
// token cache and its own (slightly different) serviceability call. Having
// two live copies of the same integration is exactly the kind of thing that
// causes intermittent "invalid response / 404" bugs: whichever module
// happened to get imported would silently diverge from the other.
//
// All real Shiprocket logic now lives in ./shipping.js. This file just
// re-exports it, plus a `selectCheapestCourier` shim for any old caller
// that expects the pre-refactor single-courier shape.
//
// New code should import directly from ./shipping.js instead.

export {
  getShiprocketToken,
  getShippingRates,
  createShiprocketShipment,
  listAvailableCouriers
} from './shipping.js';

import { listAvailableCouriers } from './shipping.js';

export function selectCheapestCourier(couriers) {
  const options = listAvailableCouriers(couriers);

  if (!options.length) {
    throw new Error('No valid courier rate was found.');
  }

  const [cheapest] = options;

  return {
    courier_company_id: cheapest.id,
    courier_name: cheapest.name,
    rate: cheapest.providerAmount,
    estimated_delivery_days: cheapest.estimatedDeliveryDays,
    etd: cheapest.etd
  };
}
