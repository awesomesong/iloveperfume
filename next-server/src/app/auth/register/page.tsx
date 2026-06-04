import { Suspense } from "react";
import RegisterForm from "../../components/RegisterForm";
import AuthFormSkeleton from "../../components/skeleton/AuthFormSkeleton";

export const dynamic = 'force-dynamic';

const RegisterPage = () => {

    return (
        <Suspense fallback={<AuthFormSkeleton />}>
            <RegisterForm />
        </Suspense>
    )
}

export default RegisterPage;
