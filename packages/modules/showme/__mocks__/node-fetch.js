/**
 * Mock for node-fetch module
 */

const fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: {
      get: () => null
    }
  })
);

export default fetch;