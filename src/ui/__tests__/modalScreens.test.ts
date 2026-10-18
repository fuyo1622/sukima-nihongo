import { readFileSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '../../app');

/** Routes the root stack presents as modals, read from `src/app/_layout.tsx`. */
function modalRoutes(): string[] {
  const layout = readFileSync(join(APP, '_layout.tsx'), 'utf8');
  return [...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"[^>]*presentation:\s*'(?:modal|fullScreenModal|formSheet|pageSheet)'/g)].map(
    (m) => m[1],
  );
}

describe('modal routes', () => {
  it('finds the modal routes', () => {
    expect(modalRoutes()).toEqual(expect.arrayContaining(['session', 'placement', 'kana-chart']));
  });

  // iOS presents modals outside the root SafeAreaProvider; without their own provider the header
  // ends up under the status bar, where it can't be tapped.
  it.each(modalRoutes())('%s wraps its page in ModalScreen', (name) => {
    const src = readFileSync(join(APP, `${name}.tsx`), 'utf8');
    expect(src).toContain('<ModalScreen>');
    expect(src).not.toMatch(/<SafeAreaView\b/);
  });
});
