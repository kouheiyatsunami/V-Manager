import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'V-Manager',
    short_name: 'V-Manager',
    description: '大会管理システム',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f4f5',
    theme_color: '#0891b2',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      }
    ]
  }
}