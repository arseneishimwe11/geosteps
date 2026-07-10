'use client';

import type { BlueprintValidation } from '../../engine/blueprint';

/** Live result of the frozen schema's validator — the gate in front of Save. */
export function ValidationPanel({ validation }: { validation: BlueprintValidation }) {
  return (
    <section
      data-testid="validation-status"
      data-ok={validation.ok}
      className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
        validation.ok ? 'border-moss/40 bg-moss-deep/30' : 'border-ember/40 bg-ember-deep/40'
      }`}
    >
      <p className={validation.ok ? 'text-moss' : 'text-ember'}>
        {validation.ok
          ? 'Blueprint is valid against the frozen schema.'
          : `Blueprint is INVALID — saving is disabled until every error below is fixed.`}
      </p>
      {validation.errors.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs text-parchment/90">
          {validation.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {validation.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs text-brass/90">
          {validation.warnings.map((w, i) => (
            <li key={i}>warning: {w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
