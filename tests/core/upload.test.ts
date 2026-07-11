import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { upload, FileValidator, validateUploadedFile, UPLOAD_METADATA_KEY, type UploadedFile, type UploadConfig } from '../../packages/core/src/upload/index.js'
import { PARAM_METADATA_KEY } from '../../packages/core/src/metadata/index.js'

describe('@upload decorator', () => {
  it('stores upload metadata', () => {
    class TestAPI {
      handler(@upload('avatar', { maxSize: '5mb', types: ['image/jpeg'] }) file: any) {}
    }

    const uploadMeta = Reflect.getOwnMetadata(UPLOAD_METADATA_KEY, TestAPI.prototype, 'handler')
    expect(uploadMeta).toBeDefined()
    expect(uploadMeta[0].maxSize).toBe('5mb')
    expect(uploadMeta[0].types).toEqual(['image/jpeg'])
  })

  it('stores param metadata for upload', () => {
    class TestAPI {
      handler(@upload('avatar') file: any) {}
    }

    const paramDefs = Reflect.getOwnMetadata(PARAM_METADATA_KEY, TestAPI.prototype, 'handler')
    const uploadParam = paramDefs.find((p: any) => p.kind === 'upload')
    expect(uploadParam).toBeDefined()
    expect(uploadParam.name).toBe('avatar')
    expect(uploadParam.type.kind).toBe('object')
  })
})

describe('FileValidator.validateSize', () => {
  it('accepts file under size limit', () => {
    const file: UploadedFile = { fieldname: 'file', originalname: 'test.txt', encoding: '7bit', mimetype: 'text/plain', size: 1000 }
    expect(FileValidator.validateSize(file, '5mb')).toBe(true)
  })

  it('rejects file over size limit', () => {
    const file: UploadedFile = { fieldname: 'file', originalname: 'big.txt', encoding: '7bit', mimetype: 'text/plain', size: 10 * 1024 * 1024 }
    expect(FileValidator.validateSize(file, '5mb')).toBe(false)
  })

  it('accepts file exactly at size limit', () => {
    const file: UploadedFile = { fieldname: 'file', originalname: 'exact.txt', encoding: '7bit', mimetype: 'text/plain', size: 1024 }
    expect(FileValidator.validateSize(file, '1kb')).toBe(true)
  })
})

describe('FileValidator.validateType', () => {
  it('accepts file with allowed type', () => {
    const file: UploadedFile = { fieldname: 'img', originalname: 'photo.jpg', encoding: '7bit', mimetype: 'image/jpeg', size: 1000 }
    expect(FileValidator.validateType(file, ['image/jpeg', 'image/png'])).toBe(true)
  })

  it('rejects file with disallowed type', () => {
    const file: UploadedFile = { fieldname: 'doc', originalname: 'file.pdf', encoding: '7bit', mimetype: 'application/pdf', size: 1000 }
    expect(FileValidator.validateType(file, ['image/jpeg'])).toBe(false)
  })

  it('allows all types when allowedTypes is empty', () => {
    const file: UploadedFile = { fieldname: 'any', originalname: 'whatever.exe', encoding: '7bit', mimetype: 'application/x-msdownload', size: 1000 }
    expect(FileValidator.validateType(file, [])).toBe(true)
  })
})

describe('FileValidator.parseMaxSize', () => {
  it('parses bytes', () => {
    expect(FileValidator.parseMaxSize('500b')).toBe(500)
  })

  it('parses kilobytes', () => {
    expect(FileValidator.parseMaxSize('10kb')).toBe(10 * 1024)
  })

  it('parses megabytes', () => {
    expect(FileValidator.parseMaxSize('5mb')).toBe(5 * 1024 * 1024)
  })

  it('parses gigabytes', () => {
    expect(FileValidator.parseMaxSize('1gb')).toBe(1 * 1024 * 1024 * 1024)
  })

  it('throws on invalid format', () => {
    expect(() => FileValidator.parseMaxSize('xyz')).toThrow(/Invalid max size format/)
  })

  it('throws on negative values (regex rejects)', () => {
    expect(() => FileValidator.parseMaxSize('-5mb')).toThrow(/Invalid max size format/)
  })
})

describe('validateUploadedFile', () => {
  it('passes validation for valid file', () => {
    const file: UploadedFile = { fieldname: 'img', originalname: 'photo.jpg', encoding: '7bit', mimetype: 'image/jpeg', size: 500 * 1024 }
    const config: UploadConfig = { maxSize: '5mb', types: ['image/jpeg'] }
    expect(() => validateUploadedFile(file, config)).not.toThrow()
  })

  it('throws on oversized file', () => {
    const file: UploadedFile = { fieldname: 'img', originalname: 'huge.jpg', encoding: '7bit', mimetype: 'image/jpeg', size: 10 * 1024 * 1024 }
    const config: UploadConfig = { maxSize: '1mb', types: ['image/jpeg'] }
    expect(() => validateUploadedFile(file, config)).toThrow(/exceeds maximum size/)
  })

  it('throws on wrong type', () => {
    const file: UploadedFile = { fieldname: 'doc', originalname: 'doc.pdf', encoding: '7bit', mimetype: 'application/pdf', size: 1000 }
    const config: UploadConfig = { maxSize: '5mb', types: ['image/jpeg'] }
    expect(() => validateUploadedFile(file, config)).toThrow(/unsupported type/)
  })
})
