import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CreateContactDialog } from '@/components/contacts/CreateContactDialog';
import { ContactsList } from '@/components/contacts/ContactsList';
import { Contact, Client } from '@/types/database';
import { cookies } from 'next/headers';

export const instant = false;

export default async function ContactsPage() {
  let contacts: Contact[] = [];
  let currentClient: Client | null = null;
  let activeClientId: string | undefined;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = await createServerSupabaseClient();
    const { data: clients } = await supabase.from('clients').select('*').order('name');

    if (clients && clients.length > 0) {
      if (!activeClientId || !clients.some((c) => c.id === activeClientId)) {
        activeClientId = clients[0].id;
      }
      currentClient = clients.find((c) => c.id === activeClientId) || clients[0];
    }

    if (activeClientId) {
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('client_id', activeClientId)
        .order('created_at', { ascending: false });

      if (contactsData) {
        contacts = contactsData;
      }
    }
  } catch (err) {
    console.warn('Error fetching contacts:', err);
  }

  // Fallback demo
  if (contacts.length === 0 && !activeClientId) {
    activeClientId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    contacts = [
      {
        id: 'c1',
        client_id: activeClientId,
        first_name: 'Carlos',
        last_name: 'Mendoza',
        email: 'carlos@empresa.com',
        phone: '+52 55 1234 5678',
        created_at: new Date().toISOString(),
      },
    ];
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Directorio de Contactos</h1>
            {currentClient && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 font-medium">
                Cliente: {currentClient.name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Lista de contactos y prospectos sincronizados con este ambiente.
          </p>
        </div>

        {activeClientId && <CreateContactDialog clientId={activeClientId} />}
      </div>

      <ContactsList contacts={contacts} />
    </div>
  );
}
