import {expect, test} from 'bun:test'

const {default: okhsl} = await import('#src/main.ts')

test('should run', () => {
  const result = okhsl()
  expect(result).toBe('okhsl') // TODO Test actual functionality
})
