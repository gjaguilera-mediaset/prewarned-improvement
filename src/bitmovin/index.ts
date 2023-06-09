import BitmovinApi from '@bitmovin/api-sdk';
import logger from '../logger'

logger.info({ message: 'Initializing Bitmovin SDK', label: 'bitmovin'})
const bitmovinApi = new BitmovinApi({ apiKey: process.env.API_KEY as string, tenantOrgId: process.env.TENANT_ORG_ID });

export default bitmovinApi