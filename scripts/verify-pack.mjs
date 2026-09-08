import { resolve } from 'node:path'
import { verifyPackage } from './verify-pack-contract.mjs'

const root = resolve(process.argv[2] ?? 'packages/compiler')
const packDir = process.env.PACK_DIR ?? '.release/pack'
verifyPackage(root, packDir)
