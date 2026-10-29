// 只显式打包实际用到的图标。src/icon 下有 1700+ 个 SVG，若用 eager glob 会全部进入主包。
import i0 from '../../icon/arrow-down-arrow-up.svg?raw'
import i1 from '../../icon/arrow-left.svg?raw'
import i2 from '../../icon/arrow-right.svg?raw'
import i3 from '../../icon/brackets-curly.svg?raw'
import i4 from '../../icon/camera.svg?raw'
import i5 from '../../icon/check.svg?raw'
import i6 from '../../icon/circle-check.svg?raw'
import i7 from '../../icon/circle-information.svg?raw'
import i8 from '../../icon/circle-xmark.svg?raw'
import i9 from '../../icon/code.svg?raw'
import i10 from '../../icon/code-compare.svg?raw'
import i11 from '../../icon/compress.svg?raw'
import i12 from '../../icon/compress-alt.svg?raw'
import i13 from '../../icon/download.svg?raw'
import i14 from '../../icon/file-alt.svg?raw'
import i15 from '../../icon/files-alt.svg?raw'
import i16 from '../../icon/folder.svg?raw'
import i17 from '../../icon/hashtag.svg?raw'
import i18 from '../../icon/image.svg?raw'
import i19 from '../../icon/link.svg?raw'
import i20 from '../../icon/menu.svg?raw'
import i21 from '../../icon/moon.svg?raw'
import i23 from '../../icon/plus.svg?raw'
import i24 from '../../icon/refresh-cw.svg?raw'
import i25 from '../../icon/rotate-cw.svg?raw'
import i26 from '../../icon/scan.svg?raw'
import i27 from '../../icon/scissors.svg?raw'
import i28 from '../../icon/search.svg?raw'
import i29 from '../../icon/sun.svg?raw'
import i30 from '../../icon/xmark.svg?raw'

export const icons: Record<string, string> = {
  'arrow-down-arrow-up': i0,
  'arrow-left': i1,
  'arrow-right': i2,
  'brackets-curly': i3,
  'camera': i4,
  'check': i5,
  'circle-check': i6,
  'circle-information': i7,
  'circle-xmark': i8,
  'code': i9,
  'code-compare': i10,
  'compress': i11,
  'compress-alt': i12,
  'download': i13,
  'file-alt': i14,
  'files-alt': i15,
  'folder': i16,
  'hashtag': i17,
  'image': i18,
  'link': i19,
  'menu': i20,
  'moon': i21,
  'plus': i23,
  'refresh-cw': i24,
  'rotate-cw': i25,
  'scan': i26,
  'scissors': i27,
  'search': i28,
  'sun': i29,
  'xmark': i30,
}
