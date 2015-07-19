/*
 * Password Management Servlets (PWM)
 * http://code.google.com/p/pwm/
 *
 * Copyright (c) 2006-2009 Novell, Inc.
 * Copyright (c) 2009-2015 The PWM Project
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

package password.pwm.config.function;

import com.novell.ldapchai.ChaiEntry;
import com.novell.ldapchai.ChaiFactory;
import com.novell.ldapchai.provider.ChaiProvider;
import password.pwm.AppProperty;
import password.pwm.PwmApplication;
import password.pwm.PwmConstants;
import password.pwm.bean.UserIdentity;
import password.pwm.config.*;
import password.pwm.error.ErrorInformation;
import password.pwm.error.PwmError;
import password.pwm.error.PwmOperationalException;
import password.pwm.error.PwmUnrecoverableException;
import password.pwm.http.PwmRequest;
import password.pwm.ldap.LdapPermissionTester;
import password.pwm.util.logging.PwmLogger;

import java.io.Serializable;
import java.util.*;

public class UserMatchViewerFunction implements SettingUIFunction {
    private static final PwmLogger LOGGER = PwmLogger.forClass(UserMatchViewerFunction.class);

    @Override
    public Serializable provideFunction(
            PwmRequest pwmRequest,
            final StoredConfiguration storedConfiguration,
            final PwmSetting setting,
            final String profile
    )
            throws Exception
    {
        final PwmApplication pwmApplication = pwmRequest.getPwmApplication();

        final int maxResultSize = Integer.parseInt(pwmApplication.getConfig().readAppProperty(AppProperty.CONFIG_EDITOR_QUERY_FILTER_TEST_LIMIT));
        final Collection<UserIdentity> users = discoverMatchingUsers(pwmApplication, maxResultSize, storedConfiguration, setting, profile);

        final HashMap<String,Object> output = new HashMap<>();
        output.put("users", users);
        output.put("sizeExceeded", users.size() >= maxResultSize);
        return output;
    }

    public Collection<UserIdentity> discoverMatchingUsers(
            final PwmApplication pwmApplication,
            final int maxResultSize,
            final StoredConfiguration storedConfiguration,
            final PwmSetting setting,
            final String profile
    )
            throws Exception
    {
        final Configuration config = new Configuration(storedConfiguration);
        final PwmApplication tempApplication = new PwmApplication.PwmEnvironment(config,pwmApplication.getApplicationPath())
                .setApplicationMode(PwmApplication.MODE.NEW)
                .setInternalRuntimeInstance(true)
                .setConfigurationFile(null)
                .setWebInfPath(pwmApplication.getWebInfPath())
                .createPwmApplication();
        final List<UserPermission> permissions = (List<UserPermission>)storedConfiguration.readSetting(setting,profile).toNativeObject();

        for (final UserPermission userPermission : permissions) {
            if (userPermission.getType() == UserPermission.Type.ldapQuery) {
                if (userPermission.getLdapBase() != null && !userPermission.getLdapBase().isEmpty()) {
                    testIfLdapDNIsValid(tempApplication, userPermission.getLdapBase(), userPermission.getLdapProfileID());
                }
            } else if (userPermission.getType() == UserPermission.Type.ldapGroup) {
                testIfLdapDNIsValid(tempApplication, userPermission.getLdapBase(), userPermission.getLdapProfileID());
            }
        }

        return LdapPermissionTester.discoverMatchingUsers(tempApplication, maxResultSize, permissions).keySet();
    }


    private void testIfLdapDNIsValid(final PwmApplication pwmApplication, final String baseDN, final String profileID)
            throws PwmOperationalException, PwmUnrecoverableException {
        final Set<String> profileIDsToTest = new LinkedHashSet<>();
        if (profileID == null || profileID.isEmpty()) {
            profileIDsToTest.add(pwmApplication.getConfig().getDefaultLdapProfile().getIdentifier());
        } else if (profileID.equals(PwmConstants.PROFILE_ID_ALL)) {
            profileIDsToTest.addAll(pwmApplication.getConfig().getLdapProfiles().keySet());
        } else {
            profileIDsToTest.add(profileID);
        }
        for (final String loopID : profileIDsToTest) {
            ChaiEntry chaiEntry = null;
            try {
                final ChaiProvider proxiedProvider = pwmApplication.getProxyChaiProvider(loopID);
                chaiEntry = ChaiFactory.createChaiEntry(baseDN, proxiedProvider);
            } catch (Exception e) {
                LOGGER.error("error while testing entry DN for profile '" + profileID + "', error:" + profileID);
            }
            if (chaiEntry != null && !chaiEntry.isValid()) {
                final String errorMsg = "entry DN '" + baseDN + "' is not valid for profile " + loopID;
                throw new PwmOperationalException(new ErrorInformation(PwmError.ERROR_LDAP_DATA_ERROR, errorMsg));
            }
        }
    }
}
