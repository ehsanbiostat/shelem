// No type declarations are published for this package (its package.json points at a
// "types" file that isn't actually included — see node_modules/@letele/playing-cards).
// Declaring the module with no body makes every import from it `any`, which is fine
// here since Card.tsx looks components up dynamically by a computed suit+rank key
// rather than importing named exports one at a time.
declare module '@letele/playing-cards';
