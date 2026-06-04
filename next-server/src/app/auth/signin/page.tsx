import { Suspense } from "react";
import SignInForm from "../../components/SignInForm";
import AuthFormSkeleton from "../../components/skeleton/AuthFormSkeleton";

export const dynamic = 'force-dynamic';

const SignInPage = () => {

    return (
      <Suspense fallback={<AuthFormSkeleton />}>
        <SignInForm />
      </Suspense>
    )
}

export default SignInPage;
