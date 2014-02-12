/*
 * Password Management Servlets (PWM)
 * http://code.google.com/p/pwm/
 *
 * Copyright (c) 2006-2009 Novell, Inc.
 * Copyright (c) 2009-2014 The PWM Project
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

package password.pwm.util.localdb;

import password.pwm.error.ErrorInformation;
import password.pwm.error.PwmError;
import password.pwm.util.PwmLogger;
import password.pwm.util.TimeDuration;

import java.io.File;
import java.sql.*;
import java.util.Map;

/**
 * Apache Derby Wrapper for {@link LocalDB} interface.   Uses a single table per DB, with
 * two columns each.  This class would be easily adaptable for a generic JDBC implementation.
 *
 * @author Jason D. Rivard
 */
public class Derby_LocalDB extends AbstractJDBC_LocalDB {
    private static final PwmLogger LOGGER = PwmLogger.getLogger(Derby_LocalDB.class, true);

    private static final String DERBY_CLASSPATH = "org.apache.derby.jdbc.EmbeddedDriver";
    private static final String DERBY_DEFAULT_SCHEMA = "APP";

    private static final String OPTION_KEY_RECLAIM_SPACE = "reclaimSpace";

    Derby_LocalDB()
            throws Exception
    {
        super();
    }

    @Override
    String getDriverClasspath()
    {
        return DERBY_CLASSPATH;
    }

    @Override
    void
    closeConnection(final Connection connection)
            throws SQLException
    {
        connection.close();
        DriverManager.getConnection("jdbc:derby:;shutdown=true");
    }

    @Override
    Connection openConnection(
            final File databaseDirectory,
            final String driverClasspath,
            final Map<String,String> initOptions
    ) throws LocalDBException {
        final String filePath = databaseDirectory.getAbsolutePath() + File.separator + "derby-db";
        final String baseConnectionURL = "jdbc:derby:" + filePath;
        final String connectionURL = baseConnectionURL + ";create=true";

        try {
            final Driver driver = (Driver)Class.forName(driverClasspath).newInstance();
            DriverManager.registerDriver(driver);
            final Connection connection = DriverManager.getConnection(connectionURL);
            connection.setAutoCommit(false);

            if (initOptions != null && initOptions.containsKey(OPTION_KEY_RECLAIM_SPACE) && Boolean.parseBoolean(initOptions.get(OPTION_KEY_RECLAIM_SPACE))) {
                reclaimSpace(connection);
            }

            return connection;
        } catch (Throwable e) {
            final String errorMsg = "error opening DB: " + e.getMessage();
            LOGGER.error(errorMsg, e);
            throw new LocalDBException(new ErrorInformation(PwmError.ERROR_LOCALDB_UNAVAILABLE,errorMsg));
        }
    }

    private static void reclaimSpace(final Connection dbConnection) {
        for (final LocalDB.DB db : LocalDB.DB.values()) {
            reclaimSpace(dbConnection,db);
        }
    }

    private static void reclaimSpace(final Connection dbConnection, final LocalDB.DB db)
    {
        final long startTime = System.currentTimeMillis();
        CallableStatement statement = null;
        try {
            LOGGER.debug("beginning reclaim space in table " + db.toString());
            statement = dbConnection.prepareCall("CALL SYSCS_UTIL.SYSCS_INPLACE_COMPRESS_TABLE(?, ?, ?, ?, ?)");
            statement.setString(1, DERBY_DEFAULT_SCHEMA);
            statement.setString(2, db.toString());
            statement.setShort(3, (short) 1);
            statement.setShort(4, (short) 1);
            statement.setShort(5, (short) 1);
            statement.execute();
            LOGGER.debug("completed reclaimed space in table " + db.toString() + " (" + TimeDuration.fromCurrent(startTime).asCompactString() + ")");
        } catch (SQLException ex) {
            LOGGER.error("error reclaiming space in table " + db.toString() + ": " + ex.getMessage());
        } finally {
            close(statement);
        }

    }
}

