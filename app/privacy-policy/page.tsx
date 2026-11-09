'use client';

import { useEffect } from 'react';

export default function PrivacyPolicyPage() {
  useEffect(() => {
    // Puedes añadir aquí lógica de tracking si deseas
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1931] text-slate-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">
            Política de Privacidad
          </h1>
          <p className="text-[18px] text-slate-400 leading-relaxed">
            Última actualización: 8 de noviembre de 2026
          </p>
        </div>

        <div className="prose dark:prose-invert max-w-none">
          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">1. Información General</h2>
          <p>
            SLT (Simple Lead Tracker) es una plataforma de gestión de leads B2B y
            marketing por email. Esta política describe qué información recopilamos,
            cómo la usamos y tus derechos respecto a tus datos personales.
          </p>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">2. Información que Recopilamos</h2>
          <ul className="list-disc list-inside text-slate-300 mb-4 space-y-2">
            <li><strong>Datos de usuario:</strong> Nombre, email, rol (admin/client_admin/operator), estado de la cuenta.</li>
            <li><strong>Datos de cliente:</strong> Nombre del cliente, slug, configuraciones multi-tenant.</li>
            <li><strong>Datos de contacto:</strong> Email, nombre, empresa, teléfono, datos adicionales (custom fields).</li>
            <li><strong>Datos de actividad:</strong> bitácora de acciones, fechas de creación, envíos de campañas, aberturas, clics.</li>
            <li><strong>Datos técnicos:</strong> bitácora de IP, fingerprint del navegador, user-agent, páginas visitadas.</li>
            <li><strong>Integraciones:</strong> Credenciales cifradas para proveedores de email (Brevo, SendGrid, Amazon SES, SMTP), tokens OAuth de redes sociales (Facebook, Instagram, LinkedIn, X, TikTok).</li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">3. Cookies y Tecnologías Similares</h2>
          <p>
            Usamos cookies para:
          </p>
          <ul className="list-disc list-inside text-slate-300 mb-4 space-y-2">
            <li>Identificar sesiones de usuario (cookie `slt_session`).</li>
            <li>Recordar la selección de cliente activo.</li>
            <li>Estadísticas anónimas mediante Google Analytics / Plausible.</li>
            <li>Tracking de aperturas y clics en campañas de email.</li>
          </ul>
          <p>
            Puedes rechazar las cookies mediante la configuración de tu navegador,
            aunque algunas funcionalidades de la plataforma pueden verse afectadas.
          </p>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">4. Uso de la Información</h2>
          <p>
            Usamos la información que recopilamos para:
          </p>
          <ul className="list-disc list-inside text-slate-300 mb-4 space-y-2">
            <li>Proporcionar y mantener la plataforma SLT.</li>
            <li>Gestionar el multi-tenant (aislamiento por cliente).</li>
            <li>Enviar campañas de email marketing con tu consentimiento.</li>
            <li>Publicar contenido en redes sociales conectadas.</li>
            <li>Mejorar la experiencia de usuario y depurar errores.</li>
            <li>Cumplir con obligaciones legales y regulatorias.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">5. Transferencias Internacionales</h2>
          <p>
            Algunos de nuestros proveedores de servicios (Amazon SES, Brevo, SendGrid,
            Meta/X/TikTok APIs) pueden estar ubicados fuera de tu país de residencia.
            Cuando transferimos tus datos a estos proveedores, aseguramos que cuenten
            con niveles de protección de datos adecuados (cláusulas contractuales tipo,
            Escudo de Privacidad, o mecanismos similares).
          </p>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">6. Retención de Datos</h2>
          <p>
            Retenemos tus datos mientras tengas una cuenta activa en SLT y durante un
            período razonable después de cerrar tu cuenta, según lo requiera la ley.
            Los datos de campañas de email y tracking se conservan según la configuración
            de tu cliente (límite de registros, purgas automáticas).
          </p>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">7. Tus Derechos</h2>
          <p>
            Puedes ejercer los siguientes derechos en cualquier momento:
          </p>
          <ul className="list-disc list-inside text-slate-300 mb-4 space-y-2">
            <li><strong>Acceso:</strong> Solicitar una copia de tus datos personales.</li>
            <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos.</li>
            <li><strong>Supresión:</strong> Solicitar la eliminación de tus datos (ver sección 8).</li>
            <li><strong>Limitación:</strong> Solicitar que limitemos el uso de tus datos.</li>
            <li><strong>Oposición:</strong> Oponerte al tratamiento de tus datos para fines de marketing.</li>
            <li><strong>Portabilidad:</strong> Solicitar tus datos en un formato estructurado.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">8. Derecho a la Eliminación de Datos</h2>
          <p>
            Tienes derecho a solicitar la eliminación de tus datos personales. Para
            solicitarlo, ponte en contacto con nosotros mediante los canales indicados
            en la sección 10. Ver también nuestra página de <a href="/data-deletion"
            className="text-[#00d4ff] hover:underline">Eliminación de Datos</a>.
          </p>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">9. Menores de Edad</h2>
          <p>
            La plataforma no está dirigida a niños menores de 13 años. No recogemos
            datos sabientemente de niños de esa edad. Si eres padre o tutor y crees
            que tu hijo nos ha proporcionado datos personales, contáctanos y eliminaremos
            dicha información.
          </p>

          <h2 className="text-2xl font-semibold text-[#00d4ff] mb-4">10. Contacto</h2>
          <p>
            Si tienes preguntas sobre esta política de privacidad, puedes contactarnos
            en: <a href="mailto:hola@inventser.com" className="text-[#00d4ff] hover:underline">
            hola@inventser.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}