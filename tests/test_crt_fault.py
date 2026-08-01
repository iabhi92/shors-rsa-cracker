import secrets

from attacker.crt_fault import crt_fault_attack, generate_crt_fault_scenario
from rsa.keygen import generate_keypair


def test_crt_signing_without_a_fault_matches_plain_modular_exponentiation():
    # Correctness check on the CRT implementation itself, before ever faulting it: Garner's
    # recombination must agree with textbook pow(m, d, n) on a completely normal key.
    kp = generate_keypair(64)
    message = 12345 % kp.public.n
    scenario = generate_crt_fault_scenario(kp, message, branch="p")
    assert scenario.correct_signature == pow(message, kp.private.d, kp.public.n)


def test_fault_attack_recovers_full_factorization_when_p_branch_faulted():
    # Deliberately a completely normal key -- no weak d, nothing unusual -- this attack doesn't
    # need a vulnerable key at all, just a real fault during CRT signing.
    kp = generate_keypair(64)
    message = 999 % kp.public.n
    scenario = generate_crt_fault_scenario(kp, message, branch="p")
    assert scenario.faulted_branch == "p"
    assert scenario.faulty_signature != scenario.correct_signature

    result = crt_fault_attack(kp.public.n, kp.public.e, message, scenario.faulty_signature)
    assert result.succeeded is True
    assert {result.recovered_p, result.recovered_q} == {kp.p, kp.q}
    assert result.recovered_p * result.recovered_q == kp.public.n


def test_fault_attack_recovers_full_factorization_when_q_branch_faulted():
    kp = generate_keypair(64)
    message = 42 % kp.public.n
    scenario = generate_crt_fault_scenario(kp, message, branch="q")
    assert scenario.faulted_branch == "q"

    result = crt_fault_attack(kp.public.n, kp.public.e, message, scenario.faulty_signature)
    assert result.succeeded is True
    assert {result.recovered_p, result.recovered_q} == {kp.p, kp.q}


def test_fault_attack_fails_on_a_correct_unfaulted_signature():
    # The attack must correctly report failure when handed a genuine, unfaulted signature --
    # gcd(s^e - m mod n, n) is n itself when s^e == m exactly, not a real factor.
    kp = generate_keypair(64)
    message = 7 % kp.public.n
    scenario = generate_crt_fault_scenario(kp, message, branch="p")
    result = crt_fault_attack(kp.public.n, kp.public.e, message, scenario.correct_signature)
    assert result.succeeded is False
    assert result.recovered_p is None
    assert result.recovered_q is None


def test_random_branch_choice_covers_both_branches_over_many_trials():
    kp = generate_keypair(48)
    branches = {generate_crt_fault_scenario(kp, secrets.randbelow(kp.public.n), branch=None).faulted_branch for _ in range(30)}
    assert branches == {"p", "q"}


def test_recovered_key_actually_verifies_real_signatures():
    # Not just "the numbers matched" -- the recovered p, q must be usable to reconstruct a
    # real, working private key for this exact public key.
    from rsa.keygen import extended_gcd, mod_inverse

    kp = generate_keypair(64)
    message = 555 % kp.public.n
    scenario = generate_crt_fault_scenario(kp, message, branch="q")
    result = crt_fault_attack(kp.public.n, kp.public.e, message, scenario.faulty_signature)
    assert result.succeeded is True

    phi = (result.recovered_p - 1) * (result.recovered_q - 1)
    assert extended_gcd(kp.public.e, phi)[0] == 1
    recovered_d = mod_inverse(kp.public.e, phi)
    assert pow(pow(message, kp.public.e, kp.public.n), recovered_d, kp.public.n) == message
