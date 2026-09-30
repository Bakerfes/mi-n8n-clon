import axios from 'axios';

const token = 'wB3fdo126ZO911K4qqD3Zp3LfyojPIGDZCYv85Ly2C0';

async function main() {
  const query = `
    query IntrospectDetails {
      assetInput: __type(name: "AssetInput") {
        inputFields {
          name
          type {
            name
            kind
            ofType {
              name
            }
          }
        }
      }
      postActionPayload: __type(name: "PostActionPayload") {
        possibleTypes {
          name
          fields {
            name
            type {
              name
              kind
              ofType {
                name
              }
            }
          }
        }
      }
    }
  `;
  const res = await axios.post('https://api.buffer.com', { query }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('AssetInput:', JSON.stringify(res.data?.data?.assetInput, null, 2));
  console.log('PostActionPayload:', JSON.stringify(res.data?.data?.postActionPayload, null, 2));
}

main().catch((e) => console.error(e.response?.data || e.message));
