import { shortOrderNumber } from "./order-utils";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envia un correo transaccional vía Resend API o simula el envío en la consola si está en dev.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "Q´ FRANELAS <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("[EMAIL WARNING] RESEND_API_KEY no configurada en las variables de entorno.");
    console.log("--------------------------------------------------");
    console.log(`[EMAIL SIMULADO - DEV]`);
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`De: ${fromEmail}`);
    console.log(`Cuerpo HTML (primeros 200 caracteres):`);
    console.log(html.replace(/<[^>]*>?/gm, "").slice(0, 200) + "...");
    console.log("--------------------------------------------------");
    return process.env.NODE_ENV !== "production";
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[EMAIL ERROR Resend]", errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[EMAIL ERROR Excepción]", error);
    return false;
  }
}

// ─── Estilos Globales Minimalistas Tipo Zara / Lefties ────────────────────────

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #111111;
  background-color: #f7f7f7;
  margin: 0;
  padding: 40px 15px;
  -webkit-font-smoothing: antialiased;
`;

const CARD_STYLES = `
  max-width: 580px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  padding: 40px 32px;
`;

const HEADER_STYLES = `
  text-align: center;
  padding-bottom: 24px;
  border-bottom: 1px solid #111111;
  margin-bottom: 32px;
`;

const CONTENT_STYLES = `
  line-height: 1.6;
  font-size: 13px;
  color: #222222;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #000000;
  color: #ffffff !important;
  text-decoration: none;
  padding: 14px 32px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 24px;
  text-align: center;
  border-radius: 0px;
`;

const FOOTER_STYLES = `
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid #e5e5e5;
  text-align: center;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #888888;
`;

// ─── Plantillas de Correo HTML Minimalistas ──────────────────────────────────────────────

export async function sendWelcomeEmail(customerName: string, customerEmail: string) {
  const subject = "¡Bienvenid@ a Q´ FRANELAS! Tu cuenta ha sido creada";
  const html = `
    <div style="${BASE_STYLES}">
      <div style="${CARD_STYLES}">
        <div style="${HEADER_STYLES}">
          <h1 style="margin:0; font-size: 20px; letter-spacing: 4px; font-weight: 900; color: #000000; text-transform: uppercase;">Q´ FRANELAS</h1>
          <p style="margin:6px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666666;">BIENVENID@ A NUESTRA TIENDA</p>
        </div>
        
        <div style="${CONTENT_STYLES}">
          <h2 style="margin:0 0 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #000000;">¡HOLA, ${customerName.toUpperCase()}!</h2>
          <p style="margin:0 0 16px; color: #444444;">Tu cuenta ha sido registrada con éxito. Ahora puedes explorar nuestras colecciones y realizar tus pedidos de forma rápida y segura.</p>
          
          <div style="border: 1px solid #e5e5e5; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #000000;">DESDE TU CUENTA PODRÁS:</p>
            <ul style="margin: 0; padding-left: 20px; color: #444444; font-size: 12px;">
              <li style="margin-bottom: 6px;">Ver precios de mayor y detal.</li>
              <li style="margin-bottom: 6px;">Consultar cuentas bancarias oficiales (Pago Móvil, Zelle, Banesco Panamá, USDT).</li>
              <li>Hacer seguimiento en tiempo real a tu pedido y guía de envío.</li>
            </ul>
          </div>

          <div style="text-align:center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://quefranelas.com"}" style="${BUTTON_STYLES}">IR A LA TIENDA</a>
          </div>
        </div>

        <div style="${FOOTER_STYLES}">
          <p style="margin:0;">Q´ FRANELAS STORE — VENEZUELA</p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}

export async function sendOrderCreatedEmail({
  customerEmail,
  customerName,
  orderNumber,
  totalUsd,
  totalVes,
  paymentType,
  reference,
}: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  totalUsd: string;
  totalVes?: string;
  paymentType: string;
  reference: string;
}) {
  const shortNum = shortOrderNumber(orderNumber);
  const subject = `Confirmación de Pedido ${shortNum} — Q´ FRANELAS`;
  const html = `
    <div style="${BASE_STYLES}">
      <div style="${CARD_STYLES}">
        <div style="${HEADER_STYLES}">
          <h1 style="margin:0; font-size: 20px; letter-spacing: 4px; font-weight: 900; color: #000000; text-transform: uppercase;">Q´ FRANELAS</h1>
          <p style="margin:6px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666666;">CONFIRMACIÓN DE ORDEN</p>
        </div>
        
        <div style="${CONTENT_STYLES}">
          <h2 style="margin:0 0 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #000000;">¡GRACIAS POR TU COMPRA, ${customerName.toUpperCase()}!</h2>
          <p style="margin:0 0 20px; color: #444444;">Hemos recibido tu pedido <strong style="font-family: monospace; color: #000000;">${shortNum}</strong> y el comprobante de pago adjuntado.</p>
          
          <div style="border: 1px solid #e5e5e5; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; color: #000000;">RESUMEN DEL PAGO</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #333333;">
              <tr>
                <td style="padding: 4px 0; color: #666666;">Monto USD:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #000000; font-family: monospace;">$${totalUsd} USD</td>
              </tr>
              ${totalVes ? `<tr><td style="padding: 4px 0; color: #666666;">Monto Estimado Bs:</td><td style="padding: 4px 0; text-align: right; font-weight: 600; color: #000000; font-family: monospace;">Bs. ${totalVes}</td></tr>` : ""}
              <tr>
                <td style="padding: 4px 0; color: #666666;">Método de Pago:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #000000;">${paymentType}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666666;">N° Referencia:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #000000; font-family: monospace;">${reference}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666666;">Estado:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 700; text-transform: uppercase; color: #000000; font-size: 11px; letter-spacing: 1px;">EN VERIFICACIÓN POR ADMINISTRACIÓN</td>
              </tr>
            </table>
          </div>

          <p style="color: #666666; margin: 20px 0;">Nuestro equipo revisará tu comprobante en el banco. Una vez validado, te notificaremos por este medio y tu pedido pasará a embalaje.</p>
        </div>

        <div style="${FOOTER_STYLES}">
          <p style="margin:0;">Q´ FRANELAS STORE — VENEZUELA</p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}

export async function sendPaymentVerifiedEmail({
  customerEmail,
  customerName,
  orderNumber,
}: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
}) {
  const shortNum = shortOrderNumber(orderNumber);
  const subject = `Pago Aprobado: Pedido ${shortNum} en embalaje — Q´ FRANELAS`;
  const html = `
    <div style="${BASE_STYLES}">
      <div style="${CARD_STYLES}">
        <div style="${HEADER_STYLES}">
          <h1 style="margin:0; font-size: 20px; letter-spacing: 4px; font-weight: 900; color: #000000; text-transform: uppercase;">Q´ FRANELAS</h1>
          <p style="margin:6px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666666;">PAGO CONFIRMADO</p>
        </div>
        
        <div style="${CONTENT_STYLES}">
          <h2 style="margin:0 0 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #000000;">PAGO VERIFICADO CON ÉXITO</h2>
          <p style="margin:0 0 16px; color: #444444;">Hola <strong>${customerName.toUpperCase()}</strong>,</p>
          <p style="margin:0 0 16px; color: #444444;">Hemos confirmado tu pago satisfactoriamente. Tu pedido <strong style="font-family: monospace; color: #000000;">${shortNum}</strong> se encuentra ahora en nuestro departamento de <strong>EMBALAJE Y PREPARACIÓN</strong>.</p>
          <p style="margin:0 0 20px; color: #444444;">Tan pronto como despachemos tu paquete con la agencia de envíos, recibirás un correo con el número de guía de seguimiento y las fotos del envío.</p>
        </div>

        <div style="${FOOTER_STYLES}">
          <p style="margin:0;">Q´ FRANELAS STORE — VENEZUELA</p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}

export async function sendOrderShippedEmail({
  customerEmail,
  customerName,
  orderNumber,
  shippingCompany,
  trackingNumber,
  packagePhotoUrl,
  guidePhotoUrl,
}: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  shippingCompany?: string | null;
  trackingNumber?: string | null;
  packagePhotoUrl?: string | null;
  guidePhotoUrl?: string | null;
}) {
  const shortNum = shortOrderNumber(orderNumber);
  const subject = `¡Tu pedido ${shortNum} ha sido enviado! — Q´ FRANELAS`;
  const html = `
    <div style="${BASE_STYLES}">
      <div style="${CARD_STYLES}">
        <div style="${HEADER_STYLES}">
          <h1 style="margin:0; font-size: 20px; letter-spacing: 4px; font-weight: 900; color: #000000; text-transform: uppercase;">Q´ FRANELAS</h1>
          <p style="margin:6px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666666;">GUÍA DE ENVÍO</p>
        </div>
        
        <div style="${CONTENT_STYLES}">
          <h2 style="margin:0 0 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #000000;">¡TU PEDIDO HA SIDO ENVIADO!</h2>
          <p style="margin:0 0 16px; color: #444444;">Hola <strong>${customerName.toUpperCase()}</strong>,</p>
          <p style="margin:0 0 20px; color: #444444;">Tu paquete del pedido <strong style="font-family: monospace; color: #000000;">${shortNum}</strong> ya fue empacado y entregado a la agencia de envíos.</p>
          
          <div style="border: 1px solid #e5e5e5; padding: 20px; margin: 24px 0;">
            <p style="margin:4px 0; color: #666666;">Empresa de Encomienda: <strong style="color: #000000;">${shippingCompany || "MRW / Zoom"}</strong></p>
            <p style="margin:4px 0; color: #666666;">Número de Guía / Tracking: <strong style="font-size: 15px; color: #000000; font-family: monospace;">${trackingNumber || "Por confirmar en agencia"}</strong></p>
          </div>

          ${
            guidePhotoUrl
              ? `
            <div style="text-align:center; margin: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; color: #000000;">COMPROBANTE DE GUÍA DE SEGUIMIENTO</p>
              <img src="${guidePhotoUrl}" alt="Foto de la guía" style="max-width: 100%; border: 1px solid #e5e5e5;" />
            </div>
          `
              : ""
          }

          ${
            packagePhotoUrl
              ? `
            <div style="text-align:center; margin: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; color: #000000;">FOTO DEL PAQUETE EMPACADO</p>
              <img src="${packagePhotoUrl}" alt="Foto del paquete" style="max-width: 100%; border: 1px solid #e5e5e5;" />
            </div>
          `
              : ""
          }

          <p style="color: #666666; text-align: center; margin-top: 24px;">¡Gracias por comprar en Q´ FRANELAS!</p>
        </div>

        <div style="${FOOTER_STYLES}">
          <p style="margin:0;">Q´ FRANELAS STORE — VENEZUELA</p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}

export async function sendVerificationPINCodeEmail(customerName: string, customerEmail: string, pinCode: string) {
  const subject = `Código PIN de Verificación: ${pinCode} — Q´ FRANELAS`;
  const html = `
    <div style="${BASE_STYLES}">
      <div style="${CARD_STYLES}">
        <div style="${HEADER_STYLES}">
          <h1 style="margin:0; font-size: 20px; letter-spacing: 4px; font-weight: 900; color: #000000; text-transform: uppercase;">Q´ FRANELAS</h1>
          <p style="margin:6px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666666;">VERIFICACIÓN DE CUENTA</p>
        </div>
        
        <div style="${CONTENT_STYLES}; text-align: center;">
          <h2 style="margin:0 0 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #000000;">¡HOLA, ${customerName.toUpperCase()}!</h2>
          <p style="margin-bottom: 12px; color: #444444;">Usa el siguiente código PIN de seguridad de 6 dígitos para verificar tu cuenta:</p>
          
          <div style="border: 1px solid #000000; padding: 20px 32px; display: inline-block; margin: 20px 0; background: #fafafa;">
            <span style="font-family: monospace, Courier, sans-serif; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #000000;">${pinCode}</span>
          </div>

          <p style="font-size: 12px; color: #888888; margin-top: 12px;">Este código vence en 15 minutos.</p>
        </div>

        <div style="${FOOTER_STYLES}">
          <p style="margin:0;">Q´ FRANELAS STORE — VENEZUELA</p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}
