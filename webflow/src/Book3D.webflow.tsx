import { Book3D } from './Book3D'
import { props } from '@webflow/data-types'
import { declareComponent } from '@webflow/react'

export default declareComponent(Book3D, {
  name: 'Book 3D',
  description: 'Interactive 3D book — drag to rotate, hover to tilt',
  group: 'Books',
  options: {
    ssr: false,
  },
  props: {
    // Content
    coverImage: props.Image({
      name: 'Cover image',
      group: 'Content',
    }),
    backImage: props.Image({
      name: 'Back image',
      group: 'Content',
    }),
    title: props.Text({
      name: 'Title',
      group: 'Content',
      defaultValue: '',
    }),
    author: props.Text({
      name: 'Author',
      group: 'Content',
      defaultValue: '',
    }),
    spineText: props.Text({
      name: 'Spine text',
      group: 'Content',
      defaultValue: '',
    }),

    // Cover look
    coverColor: props.Text({
      name: 'Cover color',
      group: 'Cover',
      defaultValue: '#1f4d3a',
    }),
    titleColor: props.Text({
      name: 'Title color',
      group: 'Cover',
      defaultValue: '#e8e0c8',
    }),
    titleFont: props.Variant({
      name: 'Title font',
      group: 'Cover',
      defaultValue: 'Georgia, serif',
      options: [
        'Georgia, serif',
        'Palatino, serif',
        '"Times New Roman", serif',
        'Helvetica, sans-serif',
        '"Courier New", monospace',
      ],
    }),
    coverFinish: props.Variant({
      name: 'Finish',
      group: 'Cover',
      defaultValue: 'satin',
      options: ['matte', 'satin', 'gloss'],
    }),
    coverTexture: props.Variant({
      name: 'Texture',
      group: 'Cover',
      defaultValue: 'smooth',
      options: ['smooth', 'cloth', 'linen', 'leather', 'paper'],
    }),

    // Spine look
    spineColor: props.Text({
      name: 'Spine color',
      group: 'Spine',
      defaultValue: '#1f4d3a',
    }),
    spineTextColor: props.Text({
      name: 'Spine text color',
      group: 'Spine',
      defaultValue: '#e8e0c8',
    }),

    // Pages look
    pageColor: props.Text({
      name: 'Page color',
      group: 'Pages',
      defaultValue: '#f4ecd8',
    }),
    endpaperColor: props.Text({
      name: 'Endpaper color',
      group: 'Pages',
      defaultValue: '#e8d9b8',
    }),

    // Construction
    hardcover: props.Boolean({
      name: 'Hardcover',
      group: 'Construction',
      defaultValue: true,
    }),
    sleeve: props.Boolean({
      name: 'Dust jacket',
      group: 'Construction',
      defaultValue: false,
    }),

    // Dimensions
    width: props.Number({
      name: 'Width',
      group: 'Dimensions',
      defaultValue: 1.4,
      min: 0.5,
      max: 3,
      decimals: 2,
    }),
    height: props.Number({
      name: 'Height',
      group: 'Dimensions',
      defaultValue: 2.0,
      min: 0.5,
      max: 3,
      decimals: 2,
    }),
    thickness: props.Number({
      name: 'Thickness',
      group: 'Dimensions',
      defaultValue: 0.2,
      min: 0.05,
      max: 2,
      decimals: 2,
    }),

    // Behaviour
    autoRotate: props.Boolean({
      name: 'Auto rotate',
      group: 'Behaviour',
      defaultValue: true,
    }),
    autoRotateSpeed: props.Number({
      name: 'Rotate speed',
      group: 'Behaviour',
      defaultValue: 0.25,
      min: 0,
      max: 1,
      decimals: 2,
    }),
    hoverTilt: props.Number({
      name: 'Hover tilt',
      group: 'Behaviour',
      defaultValue: 0.18,
      min: 0,
      max: 0.5,
      decimals: 2,
    }),

    // Container
    containerHeight: props.Text({
      name: 'Container height',
      group: 'Container',
      defaultValue: '600px',
      tooltip: 'Any CSS value, e.g. 600px, 80vh',
    }),
    background: props.Text({
      name: 'Background',
      group: 'Container',
      defaultValue: '',
      tooltip: 'CSS background. Leave empty for transparent.',
    }),
  },
})
