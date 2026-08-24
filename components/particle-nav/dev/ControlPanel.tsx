'use client';
/**
 * Dev-only control panel (demo route only — leva never enters the shipped
 * component budget). Every §6 simulation parameter, with its README range.
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
