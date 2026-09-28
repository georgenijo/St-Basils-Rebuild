import { describe, expect, it } from 'vitest'

import { selectPreviewDeployment, type DeploymentWithStatuses } from './preview'

const SHA = 'ad1ab811656d26f2b6ee5da0a85198c2f76b9d42'

function dep(partial: Partial<DeploymentWithStatuses>): DeploymentWithStatuses {
  return {
    id: 1,
    sha: SHA,
    environment: 'Preview',
    created_at: '2026-09-13T20:40:47Z',
    statuses: [],
    ...partial,
  }
}

describe('selectPreviewDeployment', () => {
  it('is pending with no deployments or no statuses', () => {
    expect(selectPreviewDeployment([], SHA)).toEqual({ state: 'pending' })
    expect(selectPreviewDeployment([dep({})], SHA)).toEqual({ state: 'pending' })
  })

  it('returns the environment_url of a successful preview for the sha', () => {
    const d = dep({
      statuses: [
        { state: 'in_progress', created_at: '2026-09-13T20:40:50Z' },
        {
          state: 'success',
          created_at: '2026-09-13T20:42:00Z',
          environment_url: 'https://st-basils-rebuild-x.vercel.app/',
          target_url: 'https://vercel.com/x',
        },
      ],
    })
    expect(selectPreviewDeployment([d], SHA)).toEqual({
      state: 'ready',
      url: 'https://st-basils-rebuild-x.vercel.app',
      deploymentId: 1,
    })
  })

  it('ignores other shas and production deployments', () => {
    const success = [
      {
        state: 'success',
        created_at: '2026-09-13T20:42:00Z',
        environment_url: 'https://x.vercel.app',
      },
    ]
    expect(selectPreviewDeployment([dep({ sha: 'other', statuses: success })], SHA)).toEqual({
      state: 'pending',
    })
    expect(
      selectPreviewDeployment([dep({ environment: 'Production', statuses: success })], SHA)
    ).toEqual({ state: 'pending' })
  })

  it('accepts suffixed preview environment names', () => {
    const d = dep({
      environment: 'Preview – st-basils-rebuild',
      statuses: [
        {
          state: 'success',
          created_at: '2026-09-13T20:42:00Z',
          environment_url: 'https://y.vercel.app',
        },
      ],
    })
    expect(selectPreviewDeployment([d], SHA)).toMatchObject({
      state: 'ready',
      url: 'https://y.vercel.app',
    })
  })

  it('uses the newest deployment and its latest status', () => {
    const older = dep({
      id: 1,
      created_at: '2026-09-13T20:00:00Z',
      statuses: [
        {
          state: 'success',
          created_at: '2026-09-13T20:01:00Z',
          environment_url: 'https://old.vercel.app',
        },
      ],
    })
    const newer = dep({
      id: 2,
      created_at: '2026-09-13T21:00:00Z',
      statuses: [{ state: 'pending', created_at: '2026-09-13T21:00:05Z' }],
    })
    expect(selectPreviewDeployment([older, newer], SHA)).toEqual({ state: 'pending' })
  })

  it('reports failures', () => {
    const d = dep({ statuses: [{ state: 'failure', created_at: '2026-09-13T20:42:00Z' }] })
    expect(selectPreviewDeployment([d], SHA)).toMatchObject({ state: 'failed' })
  })

  it('does not accept non-https urls', () => {
    const d = dep({
      statuses: [
        {
          state: 'success',
          created_at: '2026-09-13T20:42:00Z',
          environment_url: 'javascript:alert(1)',
        },
      ],
    })
    expect(selectPreviewDeployment([d], SHA)).toEqual({ state: 'pending' })
  })
})
