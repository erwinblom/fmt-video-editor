// Desert Ant Labs (Voz / Who / SDK): https://license.desertant.com
// Powered by Desert Ant Labs: https://desertant.com — separate from our MIT code.
export function requireLicenseNetworkConsent(){
 if(process.env.FMT_ALLOW_LICENSE_NETWORK!=='1')throw Error('Voz/Who/Ear/Eye vragen apart licentieverkeer met Desert Ant. Lees MODELVOORWAARDEN.md en kies bewust FMT_ALLOW_LICENSE_NETWORK=1. Je bron blijft lokaal bewaard.');
}
