// src/lib/medusa-service-schema.ts
// MedusaJS Hizmet (Service-as-a-Product) Şeması ve m² Bazlı Fiyatlandırma Yapısı

export interface CleaningServiceMetadata {
  service_category: 'office' | 'construction' | 'facade' | 'industrial' | 'medical' | 'villa';
  base_fee_tl: number;           // Sabit ekip & lojistik başlangıç ücreti
  rate_per_sqm_tl: number;       // m² başına birim fiyat (TL)
  room_surcharge_tl: number;     // Ek oda/bölüm başına ücret
  restroom_surcharge_tl: number; // Islak hacim (WC/Mutfak) başına ücret
  min_sqm: number;
  max_sqm: number;
  isg_certified: boolean;
  insurance_coverage_tl: number;
  unit_label: string;
  badge: string;
  features: string[];
}

export interface CleaningReservationLineItemMetadata {
  square_meters: number;
  room_count: number;
  restroom_count: number;
  frequency: 'once' | 'weekly' | 'biweekly' | 'daily';
  selected_addons: string[];
  preferred_date: string;
  preferred_time_slot: string;
  calculated_custom_price: number; // Kuruş cinsinden (Medusa minor unit)
}

export const TEMIZLIKPORT_SERVICES_SEED = [
  {
    id: 'prod_ofis_temizligi',
    title: 'Kurumsal Ofis & Plaza Temizliği',
    handle: 'kurumsal-ofis-temizligi',
    subtitle: 'Periyodik veya Tek Seferlik Profesyonel Ofis Hijyeni',
    description:
      'Çalışma alanlarınız için mesai öncesi veya sonrası, İSG belgeli, SGK kadrolu ve 1.000.000 TL Allianz sigorta teminatlı kurumsal ofis temizliği.',
    is_giftcard: false,
    discountable: true,
    options: [
      {
        title: 'Metrekare Kademesi',
        values: ['50-200 m²', '201-500 m²', '501-1000 m²', '1000+ m² (Plaza/Kampüs)']
      },
      {
        title: 'Hizmet Periyodu',
        values: ['Tek Seferlik', 'Haftalık Abonelik (%15 İndirimli)', 'Günlük Sabit Personel (%30 İndirimli)']
      }
    ],
    variants: [
      {
        id: 'variant_ofis_standart',
        title: '50-200 m² / Tek Seferlik',
        sku: 'TP-OFIS-200-TEK',
        manage_inventory: false,
        allow_backorder: true,
        prices: [{ currency_code: 'try', amount: 245000 }],
        metadata: { assigned_staff_count: 1, estimated_duration_hours: 4 }
      },
      {
        id: 'variant_ofis_orta',
        title: '201-500 m² / Haftalık Abonelik',
        sku: 'TP-OFIS-500-HAFTALIK',
        manage_inventory: false,
        allow_backorder: true,
        prices: [{ currency_code: 'try', amount: 395250 }],
        metadata: { assigned_staff_count: 2, estimated_duration_hours: 6, is_recurring: true }
      }
    ],
    metadata: {
      service_category: 'office',
      base_fee_tl: 1400,
      rate_per_sqm_tl: 9.5,
      room_surcharge_tl: 140,
      restroom_surcharge_tl: 220,
      min_sqm: 50,
      max_sqm: 5000,
      isg_certified: true,
      insurance_coverage_tl: 1000000,
      unit_label: "100 m²'ye kadar başlangıç",
      badge: 'En Çok Tercih Edilen',
      features: [
        'ISO 9001 & İSG Sertifikalı Kadrolu Personel',
        'Endüstriyel Ekolojik Dezenfektanlar & Ekipman Dahil',
        '1.000.000 ₺ İşyeri Hasar Güvence Sigortası',
        'QR Kodlu Dijital Denetim & Kontrol Çizelgesi'
      ]
    }
  },
  {
    id: 'prod_insaat_sonrasi',
    title: 'İnşaat & Tadilat Sonrası İnce Temizlik',
    handle: 'insaat-sonrasi-temizlik',
    subtitle: 'Buharlı Kazıma ve Endüstriyel Vakum ile Anahtar Teslim',
    description:
      'Boya, harç, silikon ve ince inşaat tozlarını yüzeylere zarar vermeyen özel buharlı makineler ve kimyasallarla anahtar teslim temizliyoruz.',
    is_giftcard: false,
    discountable: true,
    variants: [
      {
        id: 'variant_insaat_sonrasi',
        title: '100-250 m² Tam Ekipmanlı Paket',
        sku: 'TP-INSAAT-250',
        manage_inventory: false,
        allow_backorder: true,
        prices: [{ currency_code: 'try', amount: 490000 }],
        metadata: { assigned_staff_count: 3, estimated_duration_hours: 8 }
      }
    ],
    metadata: {
      service_category: 'construction',
      base_fee_tl: 2800,
      rate_per_sqm_tl: 22,
      room_surcharge_tl: 200,
      restroom_surcharge_tl: 300,
      min_sqm: 50,
      max_sqm: 5000,
      isg_certified: true,
      insurance_coverage_tl: 1000000,
      unit_label: 'Tam ekipman ve kimyasal dahil',
      badge: 'Anahtar Teslim',
      features: [
        'Endüstriyel Vakum & Buharlı Kazıma Makineleri',
        'Cam, Doğrama ve Bant/Etiket Söküm Garantisi',
        'Aynı Gün Çoklu Ekip ile Hızlı Teslimat',
        'Leke Bırakmayan Yüzey Koruyucu Uygulama'
      ]
    }
  }
];

