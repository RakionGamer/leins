import '@testing-library/jest-dom';

const matchMedia = (query) => ({
   matches: false,
   media: query,
   onchange: null,
   addListener: () => {},
   removeListener: () => {},
   addEventListener: () => {},
   removeEventListener: () => {},
   dispatchEvent: () => false
});

Object.defineProperty(window, 'matchMedia', {
   writable: true,
   configurable: true,
   value: matchMedia
});