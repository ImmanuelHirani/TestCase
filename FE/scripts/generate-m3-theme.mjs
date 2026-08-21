/**
 * Generates the Material Design 3 colour tokens for the app.
 *
 * The scheme is derived from a single brand seed colour using Google's own
 * material-color-utilities, which is the same HCT algorithm the M3 spec and the
 * Material Theme Builder use. Nothing here is hand-picked: every role resolves
 * through MaterialDynamicColors, which applies the spec's tone and contrast
 * rules. That is what guarantees the 3:1 / 4.5:1 pairings M3 promises.
 *
 *   npm run generate:theme
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  argbFromHex,
  hexFromArgb,
  Hct,
  SchemeTonalSpot,
  MaterialDynamicColors,
} from '@material/material-color-utilities';

// Jasindo corporate blue.
const SEED = '#0C4DA2';

// Every colour role in the M3 scheme, in spec order.
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant',
  'inverseSurface', 'inverseOnSurface', 'inversePrimary',
  'scrim', 'shadow', 'surfaceTint',
  'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant',
  'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
];

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function scheme(isDark) {
  // contrastLevel 0 = standard contrast, the spec default.
  return new SchemeTonalSpot(Hct.fromInt(argbFromHex(SEED)), isDark, 0);
}

function rolesToCss(isDark, indent) {
  const s = scheme(isDark);
  return ROLES.map((role) => {
    const argb = MaterialDynamicColors[role].getArgb(s);
    return indent + '--md-sys-color-' + kebab(role) + ': ' + hexFromArgb(argb) + ';';
  }).join('\n');
}

const css = [
  '/*',
  ' * Material Design 3 colour tokens — GENERATED FILE, DO NOT EDIT BY HAND.',
  ' *',
  ' * Source: scripts/generate-m3-theme.mjs',
  ' * Seed:   ' + SEED + ' (Jasindo corporate blue)',
  ' * Scheme: SchemeTonalSpot, standard contrast',
  ' *',
  ' * Regenerate with:  npm run generate:theme',
  ' */',
  '',
  ':root {',
  rolesToCss(false, '  '),
  '}',
  '',
  '/* Dark theme follows the OS setting unless the user has chosen explicitly. */',
  '@media (prefers-color-scheme: dark) {',
  "  :root:not([data-theme='light']) {",
  rolesToCss(true, '    '),
  '  }',
  '}',
  '',
  ":root[data-theme='dark'] {",
  rolesToCss(true, '  '),
  '}',
  '',
].join('\n');

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../Microfrontend/shared/m3-color.css');
writeFileSync(out, css);
console.log('Wrote ' + ROLES.length + ' colour roles x 3 blocks -> ' + out);
