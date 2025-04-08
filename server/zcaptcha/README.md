# zcaptcha
Due to bun skia-canvas incompatibility, bun ffi + the C# native captcha generator is used, with results being marshalled between bun and the C# native lib.

See https://github.com/Zekiah-A/RplaceServer/tree/main/ZCaptcha

Requuires:
 - May requuire noto-fonts-emoji systemwide font if local font path is not working. Archlinux: https://archlinux.org/packages/extra/any/noto-fonts-emoji/