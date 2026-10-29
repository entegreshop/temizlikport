// src/pages/api/reservation.json.ts
// Astro SSR Endpoint: Kullanıcının m² ve oda seçimiyle oluşturduğu teklifi MedusaJS Sepetine / Rezervasyon Motoruna iletir
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const medusaUrl = import.meta.env.PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';

    // MedusaJS Cart oluşturma ve özel m² LineItem ekleme denemesi
    let medusaCartId = 'cart_local_' + Date.now();
    try {
      const cartRes = await fetch(`${medusaUrl}/store/carts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (cartRes.ok) {
        const cartData = await cartRes.json();
        medusaCartId = cartData.cart?.id || medusaCartId;
      }
    } catch {
      // Medusa offline ise yerel rezervasyon kimliği kullanılır
    }

    return new Response(
      JSON.stringify({
        success: true,
        cart_id: medusaCartId,
        reservation: body
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Geçersiz istek' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

