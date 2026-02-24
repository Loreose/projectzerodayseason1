// app/utils/darkwebData.ts

export interface DarkwebItem {
  id: string;
  name: string;
  description: string;
  priceBTC: number;
  category: "hardware" | "software" | "info" | "other";
  stock: number;
}

export interface DarkwebMission {
  id: string;
  title: string;
  description: string;
  rewardBTC: number;
  difficulty: "Kolay" | "Orta" | "Zor" | "Ekstrem";
  client: string;
  status: "available" | "active" | "completed";
}

export const darkwebItems: DarkwebItem[] = [
  {
    id: "item_001",
    name: "Zero-Day Exploit (Windows Server 2022)",
    description: "Tamamen güncel Windows Server 2022 hedefleri için tespit edilemeyen RCE zafiyeti.",
    priceBTC: 1.5,
    category: "software",
    stock: 1
  },
  {
    id: "item_002",
    name: "Botnet Erişimi (10k Node)",
    description: "DDoS operasyonları için 10.000 cihazlık IoT botnet ağının 1 saatlik kirası.",
    priceBTC: 0.25,
    category: "software",
    stock: 5
  },
  {
    id: "item_003",
    name: "VIP Kimlik Paketi",
    description: "Temiz bir kimlik için eksiksiz belge seti, SSN ve bankacılık geçmişi.",
    priceBTC: 3.0,
    category: "info",
    stock: 2
  },
  {
    id: "item_004",
    name: "Şifreli İletişim Cihazı",
    description: "Offshore proxy'ler üzerinden yönlendirilen askeri sınıf şifreli telefon.",
    priceBTC: 0.8,
    category: "hardware",
    stock: 10
  }
];

export const darkwebMissions: DarkwebMission[] = [
  {
    id: "msn_001",
    title: "Kurumsal Casusluk",
    description: "OmniCorp'un iç sunucularından kazanç çağrısından önce Q3 mali raporlarını sızdır.",
    rewardBTC: 2.5,
    difficulty: "Orta",
    client: "Anonim",
    status: "available"
  },
  {
    id: "msn_002",
    title: "Veritabanı Silimi",
    description: "NYPD veritabanından 'M-8329' ID'li müşterinin sabıka kaydını tamamen sil.",
    rewardBTC: 5.0,
    difficulty: "Zor",
    client: "The Fixer",
    status: "available"
  },
  {
    id: "msn_003",
    title: "Fidye Yazılımı Dağıtımı",
    description: "Sağlanan fidye yazılımını hedef hastane ağına yerleştir ve çalıştır.",
    rewardBTC: 1.2,
    difficulty: "Kolay",
    client: "Syndicate",
    status: "available"
  }
];
