const dns = require('dns').promises;

async function testNodeDNS() {
  console.log('Node.js DNS testi başlatılıyor...\n');
  
  try {
    // SRV kaydı testi
    console.log('1. SRV kaydı sorgulanıyor...');
    const srvRecords = await dns.resolveSrv('_mongodb._tcp.cluster0.4kzvfk0.mongodb.net');
    console.log('✅ SRV Başarılı:', srvRecords);
  } catch (err) {
    console.error('❌ SRV Hatası:', err.code, err.message);
  }
  
  try {
    // A kaydı testi
    console.log('\n2. A kaydı sorgulanıyor...');
    const aRecords = await dns.resolve4('cluster0.4kzvfk0.mongodb.net');
    console.log('✅ A Başarılı:', aRecords);
  } catch (err) {
    console.error('❌ A Hatası:', err.code, err.message);
  }
  
  try {
    // Google DNS kullanarak test
    console.log('\n3. Google DNS (8.8.8.8) ile test...');
    const resolver = new dns.Resolver();
    resolver.setServers(['8.8.8.8']);
    const srvGoogle = await resolver.resolveSrv('_mongodb._tcp.cluster0.4kzvfk0.mongodb.net');
    console.log('✅ Google DNS SRV Başarılı:', srvGoogle);
  } catch (err) {
    console.error('❌ Google DNS Hatası:', err.code, err.message);
  }
}

testNodeDNS();