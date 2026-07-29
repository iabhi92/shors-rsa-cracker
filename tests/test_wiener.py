from attacker.wiener import generate_wiener_vulnerable_keypair, wiener_attack
from rsa.core import decrypt_int, encrypt_int
from rsa.keygen import generate_keypair


def test_wiener_recovers_the_full_private_key_from_a_vulnerable_keypair():
    kp = generate_wiener_vulnerable_keypair(64)
    result = wiener_attack(kp.public.n, kp.public.e)

    assert result.succeeded is True
    assert result.recovered_d == kp.private.d
    assert {result.recovered_p, result.recovered_q} == {kp.p, kp.q}


def test_wiener_recovered_key_actually_decrypts_real_ciphertext():
    # Not just "the numbers matched" -- the recovered d must be a real, usable private key.
    kp = generate_wiener_vulnerable_keypair(64)
    result = wiener_attack(kp.public.n, kp.public.e)
    assert result.succeeded is True

    from rsa.keygen import PrivateKey

    message = 12345 % kp.public.n
    c = encrypt_int(message, kp.public)
    recovered_key = PrivateKey(n=kp.public.n, d=result.recovered_d)
    assert decrypt_int(c, recovered_key) == message


def test_wiener_fails_against_a_normally_generated_key():
    # This project's real rsa/keygen.py picks e=65537 and derives d from it -- d comes out large
    # (on the order of N itself), nowhere near Wiener's ~N^0.25 bound. The attack must correctly
    # report failure here, not a false success.
    kp = generate_keypair(64)
    result = wiener_attack(kp.public.n, kp.public.e)
    assert result.succeeded is False
    assert result.recovered_d is None


def test_wiener_vulnerable_keypair_is_still_a_real_valid_rsa_key():
    # Deliberately weak (small d), but every real RSA identity must still hold: it's a genuine
    # keypair, not a fabricated one just for this demo to succeed against.
    kp = generate_wiener_vulnerable_keypair(48)
    assert kp.p * kp.q == kp.public.n
    message = 777 % kp.public.n
    c = encrypt_int(message, kp.public)
    assert decrypt_int(c, kp.private) == message


def test_wiener_convergents_tried_is_within_total_convergents():
    kp = generate_wiener_vulnerable_keypair(64)
    result = wiener_attack(kp.public.n, kp.public.e)
    assert 1 <= result.convergents_tried <= result.total_convergents
