import { IncrementalLFTJ } from '../src/index.js';

describe('IncrementalLFTJ', () => {
  it('should create instance', () => {
    const lftj = new IncrementalLFTJ();
    expect(lftj).toBeInstanceOf(IncrementalLFTJ);
  });
});