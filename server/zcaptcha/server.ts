/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-unused-vars */
import { dlopen, FFIType, suffix, CString, read, toArrayBuffer, Pointer, ptr } from "bun:ffi"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const libPath = join(__dirname, "ZCaptcha." + suffix)

const {
    symbols: {
        initialise,
        gen_emoji_captcha,
        gen_text_captcha,
        dispose_result
    },
} = dlopen(
    libPath,
    {
        initialise: {
            args: [ FFIType.cstring ],
            returns: FFIType.int32_t,
        },
        gen_emoji_captcha: {
            args: [],
            returns: FFIType.pointer,
        },
        gen_text_captcha: {
            args: [],
            returns: FFIType.pointer,
        },
        dispose_result: {
            args: [FFIType.pointer],
            returns: FFIType.void
        }
    }
)

function copy(src:ArrayBuffer)  {
    const destination = new ArrayBuffer(src.byteLength)
    new Uint8Array(destination).set(new Uint8Array(src))
    return destination
}

function decodeGenResult(genResult:Pointer) {
    const answerStr = new CString(genResult, 0)
    const dummiesStr = new CString(genResult, 8)
    const imgLen = read.u32(genResult, 24)
    const imageData = copy(toArrayBuffer(genResult, 16, imgLen))

    return { answer: answerStr.toString(), dummies: dummiesStr.toString(), data: imageData }
}

export function init() {
    const pathStr = join(__dirname, "Data/NotoColorEmoji-Regular.ttf")
    const pathBuffer = Buffer.from(pathStr + "\0", "utf8")
    const pathPtr = ptr(pathBuffer.buffer)
    const cPathStr = new CString(pathPtr)
    const result = initialise(cPathStr) // TODO: Investigate possible type errors
    if (result == -1) {
        throw new Error("Could not initialise zcaptcha native module. Invalid font path?")
    }
}

export type GeneratedCaptcha = () => {
    answer: string;
    dummies: string;
    data: ArrayBuffer;
}

export function genEmojiCaptcha() {
    const genResult = gen_emoji_captcha()
    if (genResult === null) {
        throw new Error("gen_emoji_captcha returned null")
    }
    const resultObj = decodeGenResult(genResult)
    dispose_result(genResult)
    return resultObj
}

export function genTextCaptcha() {
    const genResult = gen_text_captcha()
    if (genResult === null) {
        throw new Error("gen_text_captcha returned null")
    }
    const resultObj = decodeGenResult(genResult)
    dispose_result(genResult)
    return resultObj
}

export function genMathCaptcha() {
    throw new Error("Math captcha not implemented")
}