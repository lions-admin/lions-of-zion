'use client';
/**
 * The tuning panel for `/particle-demo`. Every §6 simulation parameter, with
 * its README range.
 *
 * `leva` is a devDependency, and it is absent from every route's bundle except
 * this one — but `/particle-demo` is a built, deployed route, so it does ship.
 * The previous version of this comment claimed leva "never enters the shipped
 * component budget", which was true of the home route and false of the app.
 */
import { useControls } from 'leva';
import { defaultSimParams, simParamRanges } from '../config';
import type { SimParams } from '../types';

export function useSimControls(): SimParams {
  const schema = Object.fromEntries(
    (Object.keys(defaultSimParams) as (keyof SimParams)[]).map((key) => {
      const [min, max, step] = simParamRanges[key];
      return [key, { value: defaultSimParams[key], min, max, step }];
    }),
  );
  return useControls('simulation (brief §6)', schema) as unknown as SimParams;
}
