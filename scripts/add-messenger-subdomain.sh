#!/bin/bash
# Script to add messenger.dragvertising.com subdomain to Vercel
# Run this from the dragvertising-messenger project directory

set -e

echo "💬 Adding messenger.dragvertising.com subdomain to Vercel..."
echo ""

# Check if Vercel is logged in
if ! vercel whoami &>/dev/null; then
    echo "❌ Not logged in to Vercel. Please run: vercel login"
    exit 1
fi

echo "✅ Vercel CLI is authenticated"
echo ""

# Check if project is linked
if [ ! -f ".vercel/project.json" ]; then
    echo "📦 Linking project to Vercel..."
    vercel link
fi

echo "🌐 Adding messenger.dragvertising.com domain..."
vercel domains add messenger.dragvertising.com

echo ""
echo "✅ Domain added! DNS configuration:"
echo ""
echo "Add a CNAME record in your DNS provider:"
echo "  Type: CNAME"
echo "  Name: messenger"
echo "  Value: cname.vercel-dns.com (or the value Vercel provides)"
echo "  TTL: Auto (or 3600)"
echo ""
echo "Vercel will automatically provision an SSL certificate once DNS propagates."
echo ""
echo "📋 To verify, run: vercel domains ls"
echo ""
echo "🚀 After DNS propagates, the messenger will be available at:"
echo "   https://messenger.dragvertising.com"

