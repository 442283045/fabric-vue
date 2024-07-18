import { defineConfig } from 'unocss'
import presetIcons from '@unocss/preset-icons'
import presetUno from '@unocss/preset-uno'

export default defineConfig({
  shortcuts: {
    'center-box': ['flex', 'items-center', 'justify-center'],
  },
  presets: [presetUno(), presetIcons()],
})
