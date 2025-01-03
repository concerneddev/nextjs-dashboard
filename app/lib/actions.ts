'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// schema based on actual db schema
// we will use this to parse the incoming data into db appropriate type
// we are using Zod to validate the form at Server-side
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }), // change any incoming types to number
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    // parse into the defined schema above and store into the consts
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    console.log('validatedFields: ', validatedFields);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100; // convert amount to cents for floating-point errors
    const date = new Date().toISOString().split('T')[0];

    // finally write the data into the db
    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        console.error('Database Error: Failed to Create Invoice.')
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
    /**
     * !!!
     NextJS has a feature called Client Side Router Cache. This stores the route segment in the user's browser for a time. 
     It benefits include prefetching and also ensures that users can navigate in between routes, reducing the number
     of requests made to the server.

     As data is updated thats displayed in the invoices route, we want to clear this cache and trigger a new request to 
     the server. We do this by revalidatePath().
     * !!!
     */
}

export async function updateInvoice(id: string, preState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        };
    }
    
    const {customerId, amount, status} = validatedFields.data;
    const amountInCents = amount * 100;

    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
    } catch (error) {
        console.error('Database Error: Failed to Update Invoice.')
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    //throw new err('Failed to Delete Invoice');

    try {
        await sql`
        DELETE FROM invoices WHERE id = ${id}
        `
        revalidatePath('/dashboard/invoices');
    } catch (error) {
        console.error('Database Error: Failed to Delete Invoice.')
    }
}