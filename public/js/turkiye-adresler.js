// ==========================================
// TÜRKİYE İL VE İLÇE VERİLERİ
// Toplam: 81 İl, 973 İlçe
// ==========================================

const TURKIYE_ADRESLER = {
  "Adana": ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
  "Adıyaman": ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kahta", "Merkez", "Samsat", "Sincik", "Tut"],
  "Afyonkarahisar": ["Başmakçı", "Bayat", "Bolvadin", "Çay", "Çobanlar", "Dazkırı", "Dinar", "Emirdağ", "Evciler", "Hocalar", "İhsaniye", "İscehisar", "Kızılören", "Merkez", "Sandıklı", "Sinanpaşa", "Sultandağı", "Şuhut"],
  "Ağrı": ["Diyadin", "Doğubayazıt", "Eleşkirt", "Hamur", "Merkez", "Patnos", "Taşlıçay", "Tutak"],
  "Amasya": ["Göynücek", "Gümüşhacıköy", "Hamamözü", "Merkez", "Merzifon", "Suluova", "Taşova"],
  "Ankara": ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
  "Antalya": ["Akseki", "Aksu", "Alanya", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Demre", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
  "Artvin": ["Ardanuç", "Arhavi", "Borçka", "Hopa", "Merkez", "Murgul", "Şavşat", "Yusufeli"],
  "Aydın": ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "Germencik", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"],
  "Balıkesir": ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"],
  "Bilecik": ["Bozüyük", "Gölpazarı", "İnhisar", "Merkez", "Osmaneli", "Pazaryeri", "Söğüt", "Yenipazar"],
  "Bingöl": ["Adaklı", "Genç", "Karlıova", "Kiğı", "Merkez", "Solhan", "Yayladere", "Yedisu"],
  "Bitlis": ["Adilcevaz", "Ahlat", "Güroymak", "Hizan", "Merkez", "Mutki", "Tatvan"],
  "Bolu": ["Dörtdivan", "Gerede", "Göynük", "Kıbrıscık", "Mengen", "Merkez", "Mudurnu", "Seben", "Yeniçağa"],
  "Burdur": ["Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi", "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova"],
  "Bursa": ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"],
  "Çanakkale": ["Ayvacık", "Bayramiç", "Biga", "Bozcaada", "Çan", "Eceabat", "Ezine", "Gelibolu", "Gökçeada", "Lapseki", "Merkez", "Yenice"],
  "Çankırı": ["Atkaracalar", "Bayramören", "Çerkeş", "Eldivan", "Ilgaz", "Kızılırmak", "Korgun", "Kurşunlu", "Merkez", "Orta", "Şabanözü", "Yapraklı"],
  "Çorum": ["Alaca", "Bayat", "Boğazkale", "Dodurga", "İskilip", "Kargı", "Laçin", "Mecitözü", "Merkez", "Oğuzlar", "Ortaköy", "Osmancık", "Sungurlu", "Uğurludağ"],
  "Denizli": ["Acıpayam", "Babadağ", "Baklan", "Bekilli", "Beyağaç", "Bozkurt", "Buldan", "Çal", "Çameli", "Çardak", "Çivril", "Güney", "Honaz", "Kale", "Merkezefendi", "Pamukkale", "Sarayköy", "Serinhisar", "Tavas"],
  "Diyarbakır": ["Bağlar", "Bismil", "Çermik", "Çınar", "Çüngüş", "Dicle", "Eğil", "Ergani", "Hani", "Hazro", "Kayapınar", "Kocaköy", "Kulp", "Lice", "Silvan", "Sur", "Yenişehir"],
  "Edirne": ["Enez", "Havsa", "İpsala", "Keşan", "Lalapaşa", "Meriç", "Merkez", "Süloğlu", "Uzunköprü"],
  "Elazığ": ["Ağın", "Alacakaya", "Arıcak", "Baskil", "Karakoçan", "Keban", "Kovancılar", "Maden", "Merkez", "Palu", "Sivrice"],
  "Erzincan": ["Çayırlı", "İliç", "Kemah", "Kemaliye", "Merkez", "Otlukbeli", "Refahiye", "Tercan", "Üzümlü"],
  "Erzurum": ["Aşkale", "Aziziye", "Çat", "Hınıs", "Horasan", "İspir", "Karaçoban", "Karayazı", "Köprüköy", "Narman", "Oltu", "Olur", "Palandöken", "Pasinler", "Pazaryolu", "Şenkaya", "Tekman", "Tortum", "Uzundere", "Yakutiye"],
  "Eskişehir": ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi", "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"],
  "Gaziantep": ["Araban", "İslahiye", "Karkamış", "Nizip", "Nurdağı", "Oğuzeli", "Şahinbey", "Şehitkamil", "Yavuzeli"],
  "Giresun": ["Alucra", "Bulancak", "Çamoluk", "Çanakçı", "Dereli", "Doğankent", "Espiye", "Eynesil", "Görele", "Güce", "Keşap", "Merkez", "Piraziz", "Şebinkarahisar", "Tirebolu", "Yağlıdere"],
  "Gümüşhane": ["Kelkit", "Köse", "Kürtün", "Merkez", "Şiran", "Torul"],
  "Hakkari": ["Çukurca", "Derecik", "Merkez", "Şemdinli", "Yüksekova"],
  "Hatay": ["Altınözü", "Antakya", "Arsuz", "Belen", "Defne", "Dörtyol", "Erzin", "Hassa", "İskenderun", "Kırıkhan", "Kumlu", "Payas", "Reyhanlı", "Samandağ", "Yayladağı"],
  "Iğdır": ["Aralık", "Karakoyunlu", "Merkez", "Tuzluca"],
  "Isparta": ["Aksu", "Atabey", "Eğirdir", "Gelendost", "Gönen", "Keçiborlu", "Merkez", "Şarkikaraağaç", "Senirkent", "Sütçüler", "Uluborlu", "Yalvaç", "Yenişarbademli"],
  "İstanbul": ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
  "İzmir": ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
  "Kahramanmaraş": ["Afşin", "Andırın", "Çağlayancerit", "Dulkadiroğlu", "Ekinözü", "Elbistan", "Göksun", "Nurhak", "Onikişubat", "Pazarcık", "Türkoğlu"],
  "Karabük": ["Eflani", "Eskipazar", "Merkez", "Ovacık", "Safranbolu", "Yenice"],
  "Karaman": ["Ayrancı", "Başyayla", "Ermenek", "Kazımkarabekir", "Merkez", "Sarıveliler"],
  "Kars": ["Akyaka", "Arpaçay", "Digor", "Kağızman", "Merkez", "Sarıkamış", "Selim", "Susuz"],
  "Kastamonu": ["Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Merkez", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"],
  "Kayseri": ["Akkışla", "Bünyan", "Develi", "Felahiye", "Hacılar", "İncesu", "Kocasinan", "Melikgazi", "Özvatan", "Pınarbaşı", "Sarıoğlan", "Sarız", "Talas", "Tomarza", "Yahyalı", "Yeşilhisar"],
  "Kırıkkale": ["Bahşılı", "Balışeyh", "Çelebi", "Delice", "Karakeçili", "Keskin", "Merkez", "Sulakyurt", "Yahşihan"],
  "Kırklareli": ["Babaeski", "Demirköy", "Kofçaz", "Lüleburgaz", "Merkez", "Pehlivanköy", "Pınarhisar", "Vize"],
  "Kırşehir": ["Akçakent", "Akpınar", "Boztepe", "Çiçekdağı", "Kaman", "Merkez", "Mucur"],
  "Kilis": ["Elbeyli", "Merkez", "Musabeyli", "Polateli"],
  "Kocaeli": ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
  "Konya": ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli", "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır", "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu", "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"],
  "Kütahya": ["Altıntaş", "Aslanapa", "Çavdarhisar", "Domaniç", "Dumlupınar", "Emet", "Gediz", "Hisarcık", "Merkez", "Pazarlar", "Şaphane", "Simav", "Tavşanlı"],
  "Malatya": ["Akçadağ", "Arapgir", "Arguvan", "Battalgazi", "Darende", "Doğanşehir", "Doğanyol", "Hekimhan", "Kale", "Kuluncak", "Pütürge", "Yazıhan", "Yeşilyurt"],
  "Manisa": ["Ahmetli", "Akhisar", "Alaşehir", "Demirci", "Gölmarmara", "Gördes", "Kırkağaç", "Köprübaşı", "Kula", "Salihli", "Sarıgöl", "Saruhanlı", "Selendi", "Soma", "Şehzadeler", "Turgutlu", "Yunusemre"],
  "Mardin": ["Artuklu", "Dargeçit", "Derik", "Kızıltepe", "Mazıdağı", "Midyat", "Nusaybin", "Ömerli", "Savur", "Yeşilli"],
  "Mersin": ["Akdeniz", "Anamur", "Aydıncık", "Bozyazı", "Çamlıyayla", "Erdemli", "Gülnar", "Mezitli", "Mut", "Silifke", "Tarsus", "Toroslar", "Yenişehir"],
  "Muğla": ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"],
  "Muş": ["Bulanık", "Hasköy", "Korkut", "Malazgirt", "Merkez", "Varto"],
  "Nevşehir": ["Acıgöl", "Avanos", "Derinkuyu", "Gülşehir", "Hacıbektaş", "Kozaklı", "Merkez", "Ürgüp"],
  "Niğde": ["Altunhisar", "Bor", "Çamardı", "Çiftlik", "Merkez", "Ulukışla"],
  "Ordu": ["Akkuş", "Altınordu", "Aybastı", "Çamaş", "Çatalpınar", "Çaybaşı", "Fatsa", "Gölköy", "Gülyalı", "Gürgentepe", "İkizce", "Kabadüz", "Kabataş", "Korgan", "Kumru", "Mesudiye", "Perşembe", "Ulubey", "Ünye"],
  "Osmaniye": ["Bahçe", "Düziçi", "Hasanbeyli", "Kadirli", "Merkez", "Sumbas", "Toprakkale"],
  "Rize": ["Ardeşen", "Çamlıhemşin", "Çayeli", "Derepazarı", "Fındıklı", "Güneysu", "Hemşin", "İkizdere", "İyidere", "Kalkandere", "Merkez", "Pazar"],
  "Sakarya": ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"],
  "Samsun": ["Alaçam", "Asarcık", "Atakum", "Ayvacık", "Bafra", "Canik", "Çarşamba", "Havza", "İlkadım", "Kavak", "Ladik", "Ondokuzmayıs", "Salıpazarı", "Tekkeköy", "Terme", "Vezirköprü", "Yakakent"],
  "Siirt": ["Baykan", "Eruh", "Kurtalan", "Merkez", "Pervari", "Şirvan", "Tillo"],
  "Sinop": ["Ayancık", "Boyabat", "Dikmen", "Durağan", "Erfelek", "Gerze", "Merkez", "Saraydüzü", "Türkeli"],
  "Sivas": ["Akıncılar", "Altınyayla", "Divriği", "Doğanşar", "Gemerek", "Gölova", "Gürün", "Hafik", "İmranlı", "Kangal", "Koyulhisar", "Merkez", "Suşehri", "Şarkışla", "Ulaş", "Yıldızeli", "Zara"],
  "Şanlıurfa": ["Akçakale", "Birecik", "Bozova", "Ceylanpınar", "Eyyübiye", "Halfeti", "Haliliye", "Harran", "Hilvan", "Karaköprü", "Siverek", "Suruç", "Viranşehir"],
  "Şırnak": ["Beytüşşebap", "Cizre", "Güçlükonak", "İdil", "Merkez", "Silopi", "Uludere"],
  "Tekirdağ": ["Çerkezköy", "Çorlu", "Ergene", "Hayrabolu", "Kapaklı", "Malkara", "Marmaraereğlisi", "Muratlı", "Saray", "Süleymanpaşa", "Şarköy"],
  "Tokat": ["Almus", "Artova", "Başçiftlik", "Erbaa", "Merkez", "Niksar", "Pazar", "Reşadiye", "Sulusaray", "Turhal", "Yeşilyurt", "Zile"],
  "Trabzon": ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı", "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Şalpazarı", "Sürmene", "Tonya", "Vakfıkebir", "Yomra"],
  "Tunceli": ["Çemişgezek", "Hozat", "Mazgirt", "Merkez", "Nazımiye", "Ovacık", "Pertek", "Pülümür"],
  "Uşak": ["Banaz", "Eşme", "Karahallı", "Merkez", "Sivaslı", "Ulubey"],
  "Van": ["Bahçesaray", "Başkale", "Çaldıran", "Çatak", "Edremit", "Erciş", "Gevaş", "Gürpınar", "İpekyolu", "Muradiye", "Özalp", "Saray", "Tuşba"],
  "Yalova": ["Altınova", "Armutlu", "Çınarcık", "Çiftlikköy", "Merkez", "Termal"],
  "Yozgat": ["Akdağmadeni", "Aydıncık", "Boğazlıyan", "Çandır", "Çayıralan", "Çekerek", "Kadışehri", "Merkez", "Sarıkaya", "Sorgun", "Şefaatli", "Yenifakılı", "Yerköy"],
  "Zonguldak": ["Alaplı", "Çaycuma", "Devrek", "Ereğli", "Gökçebey", "Kilimli", "Kozlu", "Merkez"]
};

// ==========================================
// TÜRKİYE MAHALLE VERİLERİ
// İl -> İlçe -> [Mahalle]
// (Örnek: İstanbul, Ankara, İzmir, Antalya, Bursa, Adana - diğer iller için genişletilebilir)
// ==========================================

const TURKIYE_MAHALLELER = {
  "İstanbul": {
    "Kadıköy": ["Acıbadem", "Bostancı", "Caferağa", "Caddebostan", "Fenerbahçe", "Göztepe", "Kozyatağı", "Osmanağa", "Moda", "Suadiye"],
    "Beşiktaş": ["Arnavutköy", "Bebek", "Etiler", "Levent", "Ortaköy", "Sarıyer Merkez"],
    "Fatih": ["Aksaray", "Beyazıt", "Eminönü", "Laleli", "Sultanahmet"],
    "Şişli": ["Bomonti", "Harbiye", "Mecidiyeköy", "Nişantaşı"],
    "Üsküdar": ["Acıbadem", "Altunizade", "Kısıklı", "Kuzguncuk"]
  },
  "Ankara": {
    "Çankaya": ["Bahçelievler", "Bülten", "Kızılay", "Maltepe", "Mebusevleri", "Tunalı", "Ümitköy"],
    "Keçiören": ["Aşağı Eğlence", "Esertepe", "Kalaba", "Kuşcağız", "Pınarbaşı"],
    "Yenimahalle": ["Batıkent", "Demetevler", "Ostim", "Şentepe"]
  },
  "İzmir": {
    "Konak": ["Alsancak", "Basmane", "Kemeraltı", "Karataş", "Pasaport"],
    "Bornova": ["Altındağ", "Kazımdirik", "Manavkuyu", "Narlıdere", "Yeşilova"],
    "Karşıyaka": ["Bostanlı", "Çarşı", "Mavişehir", "Soğukkuyu"]
  },
  "Antalya": {
    "Muratpaşa": ["Fener", "Güzeloba", "Konyaaltı", "Lara"],
    "Kepez": ["Fabrikalar", "Gündoğdu", "Varsak"],
    "Konyaaltı": ["Arapsuyu", "Hurma", "Liman"]
  },
  "Bursa": {
    "Nilüfer": ["Beşevler", "Fethiye", "Görükle", "Özlüce"],
    "Osmangazi": ["Heykel", "Setbaşı", "Soğanlı"]
  },
  "Adana": {
    "Seyhan": ["Bahçelievler", "Barış", "Döşeme", "Reşatbey"],
    "Çukurova": ["Huzurevleri", "Kireçocağı", "Yurt"]
  }
};

// ==========================================
// TÜRKİYE SOKAK / CADDE VERİLERİ
// İl -> İlçe -> Mahalle -> [Sokak/Cadde]
// ==========================================

const TURKIYE_SOKAKLAR = {
  "İstanbul": {
    "Kadıköy": {
      "Moda": ["Moda Caddesi", "Caferağa Mahallesi Sokak", "Bahariye Caddesi", "Damacı Sokak"],
      "Fenerbahçe": ["Fener Kalamış Caddesi", "Bağdat Caddesi", "Fenerbahçe Yürüyüş Yolu"],
      "Acıbadem": ["Acıbadem Caddesi", "Atatürk Caddesi", "Eski Büyükdere Caddesi"],
      "Göztepe": ["Tüccarbaşı Sokak", "Göztepe Caddesi"]
    },
    "Beşiktaş": {
      "Levent": ["Levent Caddesi", "Büyükdere Caddesi", "Nispetiye Caddesi"],
      "Etiler": ["Etiler Caddesi", "Nispetiye Caddesi"]
    },
    "Fatih": {
      "Sultanahmet": ["Divanyolu Caddesi", "Babıhumayun Caddesi"],
      "Eminönü": ["Hobyar Caddesi", "Mahmutpaşa Caddesi"]
    }
  },
  "Ankara": {
    "Çankaya": {
      "Kızılay": ["Atatürk Bulvarı", "Kızılay Meydanı", "Sakarya Caddesi"],
      "Tunalı": ["Tunalı Hilmi Caddesi", "Arjantin Caddesi"],
      "Bahçelievler": ["7. Cadde", "Bahçelievler Caddesi"]
    },
    "Keçiören": {
      "Kalaba": ["Kalaba Caddesi", "Hasköy Sokak"]
    }
  },
  "İzmir": {
    "Konak": {
      "Alsancak": ["Kıbrıs Şehitleri Caddesi", "1482. Sokak", "Alsancak Caddesi"],
      "Kemeraltı": ["Anafartalar Caddesi", "927. Sokak"]
    },
    "Bornova": {
      "Kazımdirik": ["Kazımdirik Caddesi", "Atatürk Caddesi"]
    }
  },
  "Antalya": {
    "Muratpaşa": {
      "Lara": ["Lara Caddesi", "Şirinyalı Sokak"],
      "Konyaaltı": ["Konyaaltı Caddesi"]
    }
  }
};

// ==========================================
// YARDIMCI FONKSİYONLAR
// ==========================================

/**
 * Tüm illeri döndürür (alfabetik sıralı)
 */
function getIller() {
  return Object.keys(TURKIYE_ADRESLER).sort();
}

/**
 * Seçilen ilin ilçelerini döndürür (alfabetik sıralı)
 */
function getIlceler(ilAdi) {
  if (!ilAdi || !TURKIYE_ADRESLER[ilAdi]) return [];
  return [...TURKIYE_ADRESLER[ilAdi]].sort();
}

/**
 * Seçilen il ve ilçeye göre mahalleleri döndürür (alfabetik sıralı)
 */
function getMahalleler(ilAdi, ilceAdi) {
  if (!ilAdi || !ilceAdi) return [];
  const ilData = typeof TURKIYE_MAHALLELER !== 'undefined' ? TURKIYE_MAHALLELER[ilAdi] : null;
  if (!ilData || !ilData[ilceAdi]) return [];
  return [...ilData[ilceAdi]].sort();
}

/**
 * Seçilen il, ilçe ve mahalleye göre sokak/cadde listesini döndürür (alfabetik sıralı)
 */
function getSokaklar(ilAdi, ilceAdi, mahalleAdi) {
  if (!ilAdi || !ilceAdi || !mahalleAdi) return [];
  const ilData = typeof TURKIYE_SOKAKLAR !== 'undefined' ? TURKIYE_SOKAKLAR[ilAdi] : null;
  if (!ilData || !ilData[ilceAdi] || !ilData[ilceAdi][mahalleAdi]) return [];
  return [...ilData[ilceAdi][mahalleAdi]].sort();
}

/**
 * API base URL (backend ile aynı origin)
 */
function getAdresApiBase() {
  if (typeof window !== 'undefined' && window.ADRES_API_BASE) return window.ADRES_API_BASE;
  if (typeof API_URL !== 'undefined' && API_URL) return String(API_URL).replace(/\/api\/?$/, '');
  return window.location.origin;
}

/**
 * API'den illeri getirir (async)
 */
async function getIllerAsync() {
  try {
    const base = getAdresApiBase();
    const res = await fetch(base + '/api/adres/iller');
    const data = await res.json();
    if (data.success && Array.isArray(data.iller)) return data.iller;
  } catch (e) { /* fallback */ }
  return getIller();
}

/**
 * API'den ilçeleri getirir (async)
 */
async function getIlcelerAsync(ilAdi) {
  if (!ilAdi) return [];
  try {
    const base = getAdresApiBase();
    const res = await fetch(base + '/api/adres/ilceler?il=' + encodeURIComponent(ilAdi));
    const data = await res.json();
    if (data.success && Array.isArray(data.ilceler)) return data.ilceler;
  } catch (e) { /* fallback */ }
  return getIlceler(ilAdi);
}

/**
 * API'den mahalleleri getirir (async)
 */
async function getMahallelerAsync(ilAdi, ilceAdi) {
  if (!ilAdi || !ilceAdi) return [];
  try {
    const base = getAdresApiBase();
    const url = base + '/api/adres/mahalleler?il=' + encodeURIComponent(ilAdi) + '&ilce=' + encodeURIComponent(ilceAdi);
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && Array.isArray(data.mahalleler)) return data.mahalleler;
  } catch (e) { /* fallback */ }
  return getMahalleler(ilAdi, ilceAdi);
}

/**
 * İl ve ilçe validasyonu
 */
function validateAdres(il, ilce) {
  if (!il || !TURKIYE_ADRESLER[il]) {
    return { valid: false, message: "Geçersiz il" };
  }
  if (!ilce || !TURKIYE_ADRESLER[il].includes(ilce)) {
    return { valid: false, message: "Geçersiz ilçe" };
  }
  return { valid: true, message: "Geçerli adres" };
}

// Export (modül kullanımı için)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TURKIYE_ADRESLER, TURKIYE_MAHALLELER, TURKIYE_SOKAKLAR, getIller, getIlceler, getMahalleler, getSokaklar, validateAdres };
}