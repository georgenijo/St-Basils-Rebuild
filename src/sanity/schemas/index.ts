import { SchemaTypeDefinition } from 'sanity'

import clergy from './clergy'
import officeBearer from './officeBearer'
import organization from './organization'
import pageContent from './pageContent'
import spiritualLeader from './spiritualLeader'

export const schemaTypes: SchemaTypeDefinition[] = [clergy, officeBearer, organization, pageContent, spiritualLeader]
