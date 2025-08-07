// Minimal React/JSX shims for projects without @types/react
// This relaxes type-checking for JSX to avoid editor/linter noise.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any
  }
}

declare module 'react' {
  const React: any
  export default React
  export const useState: any
  export const useEffect: any
  export const StrictMode: any
}

declare module 'react/jsx-runtime' {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
} 