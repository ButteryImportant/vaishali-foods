import assert from 'node:assert/strict';
import { selectCheapestCourier } from '../functions/lib/shiprocket.js';

const couriers = [
  {
    courier_company_id: '1',
    courier_name: 'First option',
    rate: '226'
  },
  {
    courier_company_id: '2',
    courier_name: 'Lower option',
    rate: '149'
  },
  {
    courier_company_id: '3',
    courier_name: 'Premium option',
    rate: '300'
  }
];

const selected = selectCheapestCourier(couriers);
assert.equal(selected.rate, '226');
console.log('Selected rate:', selected.rate);
