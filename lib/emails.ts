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
  const fromEmail = process.env.EMAIL_FROM || "Cenicola Hub <notificaciones@cenicolas.com>";

  if (!apiKey) {
    console.log("--------------------------------------------------");
    console.log(`[EMAIL SIMULADO - DEV]`);
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`De: ${fromEmail}`);
    console.log(`Cuerpo HTML (primeros 200 caracteres):`);
    console.log(html.replace(/<[^>]*>?/gm, "").slice(0, 200) + "...");
    console.log("--------------------------------------------------");
    return true;
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

// ─── Plantillas de Correo HTML ──────────────────────────────────────────────

export async function sendWelcomeEmail(customerName: string, customerEmail: string) {
  const subject = "¡Bienvenid@ a Cenicola! Tu cuenta ha sido creada";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #111827; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">CENICOLA</h1>
        <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 14px;">Moda y Calidad</p>
      </div>
      <div style="padding: 24px; color: #374151; line-height: 1.6;">
        <h2 style="color: #111827; margin-top: 0;">¡Hola, ${customerName}!</h2>
        <p>Tu cuenta ha sido registrada con éxito en nuestra tienda. Ahora puedes acceder a tu panel para explorar nuestras colecciones y realizar tus pedidos de forma rápida y segura.</p>
        <p style="margin-top: 24px;">Desde tu cuenta podrás:</p>
        <ul>
          <li>Ver los precios de mayor y detalle.</li>
          <li>Consultar las cuentas bancarias oficiales (Pago Móvil, Zelle, Banesco Panamá, USDT).</li>
          <li>Hacer seguimiento en tiempo real al estado de tu pedido y guía de envío.</li>
        </ul>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" style="background: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir a la Tienda</a>
        </div>
      </div>
      <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Cenicola Hub. Todos los derechos reservados.
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
  const subject = `Pedido Recibido ${shortNum} - Cenicola`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #111827; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">CENICOLA</h1>
        <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 14px;">Confirmación de Orden ${shortNum}</p>
      </div>
      <div style="padding: 24px; color: #374151; line-height: 1.6;">
        <h2 style="color: #111827; margin-top: 0;">¡Gracias por tu compra, ${customerName}!</h2>
        <p>Hemos recibido tu pedido <strong>${shortNum}</strong> y el comprobante de pago adjuntado.</p>
        
        <div style="background: #f3f4f6; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #111827; font-size: 16px;">Resumen del Pago:</h3>
          <p style="margin: 4px 0;"><strong>Monto USD:</strong> $${totalUsd}</p>
          ${totalVes ? `<p style="margin: 4px 0;"><strong>Monto Estimado Bs:</strong> Bs. ${totalVes}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Método de Pago:</strong> ${paymentType}</p>
          <p style="margin: 4px 0;"><strong>N° Referencia:</strong> ${reference}</p>
          <p style="margin: 4px 0;"><strong>Estado:</strong> <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En verificación por Administración</span></p>
        </div>

        <p>Nuestro equipo revisará tu comprobante en el banco. Una vez validado, te notificaremos por este medio y tu pedido pasará a empaque.</p>
      </div>
      <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Cenicola Hub.
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
  const subject = `¡Pago Verificado! Tu pedido ${shortNum} pasa a Embalaje`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #059669; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">¡PAGO VERIFICADO!</h1>
        <p style="margin: 4px 0 0 0; color: #d1fae5; font-size: 14px;">Pedido ${shortNum}</p>
      </div>
      <div style="padding: 24px; color: #374151; line-height: 1.6;">
        <h2 style="color: #111827; margin-top: 0;">¡Buenas noticias, ${customerName}!</h2>
        <p>Hemos confirmado tu pago satisfactoriamente en el banco. Tu pedido <strong>${shortNum}</strong> se encuentra ahora en nuestro departamento de <strong>Embalaje y Preparación</strong>.</p>
        <p>Tan pronto como nuestro embalador despache tu paquete con la agencia de envíos, recibirás un correo con el número de guía de seguimiento y la foto de tu paquete.</p>
      </div>
      <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Cenicola Hub.
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
}: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  shippingCompany?: string | null;
  trackingNumber?: string | null;
  packagePhotoUrl?: string | null;
}) {
  const shortNum = shortOrderNumber(orderNumber);
  const subject = `¡Tu pedido ${shortNum} ha sido enviado! 🚚`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #0284c7; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">¡TU PEDIDO VA EN CAMINO!</h1>
        <p style="margin: 4px 0 0 0; color: #e0f2fe; font-size: 14px;">Pedido ${shortNum}</p>
      </div>
      <div style="padding: 24px; color: #374151; line-height: 1.6;">
        <h2 style="color: #111827; margin-top: 0;">¡Hola, ${customerName}!</h2>
        <p>Tu paquete para el pedido <strong>${shortNum}</strong> ha sido empacado y entregado a la agencia de envíos.</p>
        
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1; font-size: 16px;">Datos del Envío:</h3>
          <p style="margin: 4px 0;"><strong>Empresa de Encomienda:</strong> ${shippingCompany || "MRW / Zoom"}</p>
          <p style="margin: 4px 0;"><strong>Número de Guía (Tracking):</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; background: #ffffff; padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 4px;">${trackingNumber || "Por confirmar en agencia"}</span></p>
        </div>

        ${
          packagePhotoUrl
            ? `
          <div style="text-align: center; margin: 24px 0;">
            <p style="font-size: 14px; font-weight: bold; color: #475569; margin-bottom: 8px;">Foto del Paquete Despachado:</p>
            <img src="${packagePhotoUrl}" alt="Foto del paquete" style="max-width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
          </div>
        `
            : ""
        }

        <p>Gracias por comprar en Cenicola. ¡Esperamos que disfrutes tus productos!</p>
      </div>
      <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Cenicola Hub.
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}

export async function sendVerificationPINCodeEmail(customerName: string, customerEmail: string, pinCode: string) {
  const subject = `${pinCode} es tu código de verificación Cenicola`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #111827; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">CENICOLA</h1>
        <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Verificación de Cuenta de Cliente</p>
      </div>
      <div style="padding: 32px 24px; color: #374151; line-height: 1.6; text-align: center;">
        <h2 style="color: #111827; margin-top: 0;">¡Hola, ${customerName}!</h2>
        <p>Usa el siguiente código PIN para confirmar tu dirección de correo electrónico y completar tu registro:</p>
        
        <div style="background: #f3f4f6; border: 2px dashed #9ca3af; border-radius: 8px; padding: 16px 24px; display: inline-block; margin: 24px 0;">
          <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111827;">${pinCode}</span>
        </div>

        <p style="font-size: 13px; color: #6b7280;">Este código vence en 15 minutos. Si no solicitaste este registro, puedes ignorar este mensaje.</p>
      </div>
      <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Cenicola. Todos los derechos reservados.
      </div>
    </div>
  `;

  return sendEmail({ to: customerEmail, subject, html });
}

