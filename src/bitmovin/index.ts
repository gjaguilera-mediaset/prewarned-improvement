import BitmovinApi from '@bitmovin/api-sdk';

const bitmovinApi = new BitmovinApi({ apiKey: process.env.API_KEY as string, tenantOrgId: process.env.TENANT_ORG_ID });

export default bitmovinApi