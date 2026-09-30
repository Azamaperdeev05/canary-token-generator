// ===================
// ©AngelaMos | 2026
// routers.tsx
// ===================

import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { ROUTES } from '@/config'
import { Shell } from './shell'

const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      {
        path: ROUTES.HOME,
        lazy: () => import('@/pages/landing'),
      },
      {
        path: ROUTES.LURE,
        lazy: () => import('@/pages/lure'),
      },
      {
        path: '*',
        lazy: () => import('@/pages/notfound'),
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
